import crypto from 'node:crypto';
import type { Database } from '@agentsync/db';
import { accounts, oauthClients, oauthCodes, refreshTokens, users } from '@agentsync/db';
import { and, eq } from 'drizzle-orm';
import { getConfig } from '../../config.js';
import { logger } from '../../infra/logger.js';
import type { CacheService } from '../cache/cache.service.js';
import { type JwtPayload, signJwt, verifyJwt } from './jwt.js';

export class AuthService {
	constructor(
		private db: Database,
		private cache: CacheService,
	) {}

	async createAuthorizationCode(params: {
		userId: string;
		clientId: string;
		redirectUri: string;
		scope?: string;
		codeChallenge: string;
		codeChallengeMethod: string;
	}): Promise<string> {
		const code = crypto.randomBytes(32).toString('hex');
		const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

		await this.db.insert(oauthCodes).values({
			code,
			userId: params.userId,
			clientId: params.clientId,
			redirectUri: params.redirectUri,
			scope: params.scope,
			codeChallenge: params.codeChallenge,
			codeChallengeMethod: params.codeChallengeMethod,
			expiresAt,
		});

		return code;
	}

	async exchangeCode(params: {
		code: string;
		redirectUri: string;
		clientId: string;
		codeVerifier: string;
		clientSecret?: string;
	}): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
		const [authCode] = await this.db
			.select()
			.from(oauthCodes)
			.where(and(eq(oauthCodes.code, params.code), eq(oauthCodes.clientId, params.clientId)));

		if (!authCode) throw new Error('Invalid authorization code');
		if (authCode.redirectUri !== params.redirectUri) throw new Error('Redirect URI mismatch');
		if (new Date() > authCode.expiresAt) throw new Error('Authorization code expired');

		// Confidential clients must present their client_secret on the token endpoint.
		// Public clients (PKCE-only, e.g. MCP) skip this check.
		const client = await this.getOAuthClient(params.clientId);
		if (!client) throw new Error('Invalid client');
		if (client.isConfidential && client.clientSecret) {
			if (!params.clientSecret || params.clientSecret !== client.clientSecret) {
				throw new Error('Invalid client_secret');
			}
		}

		// Verify PKCE
		const expectedChallenge = crypto
			.createHash('sha256')
			.update(params.codeVerifier)
			.digest('base64url');

		if (expectedChallenge !== authCode.codeChallenge) {
			throw new Error('Invalid code verifier');
		}

		// Delete used code
		await this.db.delete(oauthCodes).where(eq(oauthCodes.code, params.code));

		// Get user with role
		const [user] = await this.db.select().from(users).where(eq(users.id, authCode.userId));

		if (!user) throw new Error('User not found');
		const [account] = user.accountId
			? await this.db.select().from(accounts).where(eq(accounts.id, user.accountId))
			: [null];

		return this.issueTokensForUser({
			user,
			clientId: params.clientId,
			scope: authCode.scope ?? undefined,
			account,
		});
	}

	async refreshAccessToken(params: {
		refreshToken: string;
		clientId: string;
	}): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
		const [token] = await this.db
			.select()
			.from(refreshTokens)
			.where(
				and(
					eq(refreshTokens.token, params.refreshToken),
					eq(refreshTokens.clientId, params.clientId),
					eq(refreshTokens.revoked, false),
				),
			);

		if (!token) throw new Error('Invalid refresh token');
		if (new Date() > token.expiresAt) throw new Error('Refresh token expired');

		// Revoke old token (rotation)
		await this.db
			.update(refreshTokens)
			.set({ revoked: true })
			.where(eq(refreshTokens.id, token.id));

		// Get user
		const [user] = await this.db.select().from(users).where(eq(users.id, token.userId));

		if (!user) throw new Error('User not found');
		const [account] = user.accountId
			? await this.db.select().from(accounts).where(eq(accounts.id, user.accountId))
			: [null];

		return this.issueTokensForUser({
			user,
			clientId: params.clientId,
			scope: token.scope ?? undefined,
			account,
		});
	}

	async revokeToken(token: string): Promise<void> {
		await this.db
			.update(refreshTokens)
			.set({ revoked: true })
			.where(eq(refreshTokens.token, token));
		await this.cache.set(`revoked:${token}`, true, 86400);
	}

	async validateToken(token: string): Promise<JwtPayload> {
		// Check revocation cache
		const revoked = await this.cache.get<boolean>(`revoked:${token}`);
		if (revoked) throw new Error('Token revoked');

		return verifyJwt(token);
	}

	async getOAuthClient(clientId: string) {
		const [client] = await this.db
			.select()
			.from(oauthClients)
			.where(eq(oauthClients.clientId, clientId));
		return client ?? null;
	}

	async registerDynamicClient(params: {
		clientName: string;
		redirectUris: string[];
		isPublic?: boolean;
	}): Promise<{
		clientId: string;
		clientSecret?: string;
		clientIdIssuedAt: number;
		redirectUris: string[];
		tokenEndpointAuthMethod: 'none' | 'client_secret_post';
	}> {
		const isPublic = params.isPublic ?? true;
		const clientId = `mcp-${crypto.randomBytes(12).toString('base64url')}`;
		const clientSecret = isPublic ? null : crypto.randomBytes(32).toString('base64url');

		const [created] = await this.db
			.insert(oauthClients)
			.values({
				clientId,
				clientSecret,
				name: params.clientName.slice(0, 255),
				redirectUris: params.redirectUris,
				isConfidential: !isPublic,
			})
			.returning();

		return {
			clientId: created.clientId,
			clientSecret: clientSecret ?? undefined,
			clientIdIssuedAt: Math.floor(Date.now() / 1000),
			redirectUris: created.redirectUris,
			tokenEndpointAuthMethod: isPublic ? 'none' : 'client_secret_post',
		};
	}

	async createDeviceAuthorization(params: { clientId: string; scope?: string }) {
		const client = await this.getOAuthClient(params.clientId);
		if (!client) throw new Error('Invalid client');

		const deviceCode = crypto.randomBytes(32).toString('base64url');
		const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
		const raw = crypto.randomBytes(8);
		const userCode = Array.from(raw)
			.map((b) => alphabet[b % alphabet.length])
			.join('')
			.slice(0, 8);
		const expiresIn = 600;
		const interval = 5;
		const expiresAt = Date.now() + expiresIn * 1000;
		const entry = {
			clientId: params.clientId,
			scope: params.scope ?? '',
			approved: false,
			userId: '',
			expiresAt,
		};

		await this.cache.set(`oauth:device:${deviceCode}`, entry, expiresIn);
		await this.cache.set(`oauth:usercode:${userCode}`, { deviceCode }, expiresIn);

		const config = getConfig();
		return {
			deviceCode,
			userCode,
			verificationUri: `${config.PUBLIC_BASE_URL}/oauth/device/verify`,
			expiresIn,
			interval,
		};
	}

	async approveDeviceAuthorization(params: { userCode: string; userId: string }) {
		const mapping = await this.cache.get<{ deviceCode: string }>(
			`oauth:usercode:${params.userCode}`,
		);
		if (!mapping?.deviceCode) throw new Error('Invalid user code');

		const key = `oauth:device:${mapping.deviceCode}`;
		const entry = await this.cache.get<{
			clientId: string;
			scope: string;
			approved: boolean;
			userId: string;
			expiresAt: number;
		}>(key);
		if (!entry) throw new Error('Device code not found');
		if (Date.now() > entry.expiresAt) throw new Error('Device code expired');

		const ttl = Math.max(1, Math.floor((entry.expiresAt - Date.now()) / 1000));
		await this.cache.set(key, { ...entry, approved: true, userId: params.userId }, ttl);
		return { approved: true };
	}

	async exchangeDeviceCode(params: { deviceCode: string; clientId: string }) {
		const key = `oauth:device:${params.deviceCode}`;
		const entry = await this.cache.get<{
			clientId: string;
			scope: string;
			approved: boolean;
			userId: string;
			expiresAt: number;
		}>(key);
		if (!entry) throw new Error('invalid_grant');
		if (entry.clientId !== params.clientId) throw new Error('invalid_client');
		if (Date.now() > entry.expiresAt) throw new Error('expired_token');
		if (!entry.approved || !entry.userId) throw new Error('authorization_pending');

		const [user] = await this.db.select().from(users).where(eq(users.id, entry.userId));
		if (!user) throw new Error('invalid_grant');

		const [account] = user.accountId
			? await this.db.select().from(accounts).where(eq(accounts.id, user.accountId))
			: [null];

		await this.cache.del(key);

		return this.issueTokensForUser({
			user,
			clientId: params.clientId,
			scope: entry.scope || undefined,
			account,
		});
	}

	private async issueTokensForUser(params: {
		user: typeof users.$inferSelect;
		clientId: string;
		scope?: string;
		account?: typeof accounts.$inferSelect | null;
	}): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
		const accessToken = await signJwt({
			sub: params.user.id,
			team: params.user.teamId,
			role: params.user.roleId ?? '',
			scopes: params.scope ?? '',
			account_id: params.user.accountId ?? undefined,
			limits_tier: params.account?.limitsTier as 'unverified' | 'verified' | undefined,
			token_type: 'team',
		});

		const refreshTokenValue = crypto.randomBytes(32).toString('hex');
		const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
		await this.db.insert(refreshTokens).values({
			token: refreshTokenValue,
			userId: params.user.id,
			clientId: params.clientId,
			scope: params.scope,
			expiresAt: refreshExpiresAt,
		});

		return {
			accessToken,
			refreshToken: refreshTokenValue,
			expiresIn: 900,
		};
	}
}
