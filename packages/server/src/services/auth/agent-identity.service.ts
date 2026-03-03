import crypto from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import type { Database } from '@agentsync/db';
import {
	accounts,
	accountRefreshTokens,
	agentAuthChallenges,
	agents,
	users,
} from '@agentsync/db';
import { signJwt } from './jwt.js';
import { getConfig } from '../../config.js';

function canonicalize(value: unknown): string {
	if (Array.isArray(value)) {
		return `[${value.map((item) => canonicalize(item)).join(',')}]`;
	}
	if (value && typeof value === 'object') {
		const entries = Object.entries(value as Record<string, unknown>)
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([key, val]) => `"${key}":${canonicalize(val)}`);
		return `{${entries.join(',')}}`;
	}
	return JSON.stringify(value);
}

function computeThumbprint(jwk: Record<string, unknown>): string {
	return crypto
		.createHash('sha256')
		.update(canonicalize(jwk))
		.digest('base64url');
}

function verifySignature(jwk: Record<string, unknown>, challenge: string, signature: string): boolean {
	const keyObject = crypto.createPublicKey({ key: jwk, format: 'jwk' });
	const sig = Buffer.from(signature, 'base64url');
	const payload = Buffer.from(challenge, 'utf8');

	if (keyObject.asymmetricKeyType === 'ed25519' || keyObject.asymmetricKeyType === 'ed448') {
		return crypto.verify(null, payload, keyObject, sig);
	}

	const verifier = crypto.createVerify('sha256');
	verifier.update(payload);
	verifier.end();
	return verifier.verify(keyObject, sig);
}

export class AgentIdentityService {
	constructor(private db: Database) {}

	async createChallenge(publicKeyJwk: Record<string, unknown>, label?: string) {
		const challenge = crypto.randomBytes(32).toString('base64url');
		const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

		const [row] = await this.db
			.insert(agentAuthChallenges)
			.values({
				challenge,
				publicKeyJwk: JSON.stringify(publicKeyJwk),
				label,
				expiresAt,
			})
			.returning();

		return {
			challengeId: row.id,
			challenge,
			expiresAt,
		};
	}

	async registerFromChallenge(params: {
		challengeId: string;
		publicKeyJwk: Record<string, unknown>;
		signature: string;
		createAccountIfMissing?: boolean;
	}) {
		const [challengeRow] = await this.db
			.select()
			.from(agentAuthChallenges)
			.where(eq(agentAuthChallenges.id, params.challengeId));

		if (!challengeRow) {
			throw new Error('Challenge not found');
		}
		if (challengeRow.consumedAt) {
			throw new Error('Challenge already used');
		}
		if (new Date() > challengeRow.expiresAt) {
			throw new Error('Challenge expired');
		}

		const expectedJwk = JSON.parse(challengeRow.publicKeyJwk);
		if (canonicalize(expectedJwk) !== canonicalize(params.publicKeyJwk)) {
			throw new Error('Public key does not match challenge');
		}

		const valid = verifySignature(params.publicKeyJwk, challengeRow.challenge, params.signature);
		if (!valid) {
			throw new Error('Invalid signature');
		}

		const thumbprint = computeThumbprint(params.publicKeyJwk);
		let [agent] = await this.db
			.select()
			.from(agents)
			.where(eq(agents.thumbprint, thumbprint));
		let accountId: string;

		if (agent) {
			accountId = agent.accountId;
			await this.db
				.update(agents)
				.set({ lastSeenAt: new Date() })
				.where(eq(agents.id, agent.id));
		} else {
			if (params.createAccountIfMissing === false) {
				throw new Error('Agent is not registered');
			}
			const [account] = await this.db
				.insert(accounts)
				.values({})
				.returning();
			accountId = account.id;

			[agent] = await this.db
				.insert(agents)
				.values({
					accountId,
					thumbprint,
					publicKeyJwk: params.publicKeyJwk,
					label: challengeRow.label,
					lastSeenAt: new Date(),
				})
				.returning();
		}

		await this.db
			.update(agentAuthChallenges)
			.set({ consumedAt: new Date() })
			.where(eq(agentAuthChallenges.id, challengeRow.id));

		return {
			accountId,
			agentId: agent.id,
			thumbprint,
		};
	}

	async issueOnboardingTokens(accountId: string, agentId?: string) {
		const config = getConfig();
		const [account] = await this.db
			.select()
			.from(accounts)
			.where(eq(accounts.id, accountId));
		if (!account) {
			throw new Error('Account not found');
		}

		const accessToken = await signJwt(
			{
				sub: accountId,
				account_id: accountId,
				agent_id: agentId,
				limits_tier: account.limitsTier as 'unverified' | 'verified',
				token_type: 'onboarding',
			},
			config.ONBOARDING_JWT_EXPIRY,
		);

		const refreshToken = crypto.randomBytes(32).toString('hex');
		const refreshExpiresAt = new Date(Date.now() + this.parseExpiryMs(config.ONBOARDING_REFRESH_EXPIRY));

		await this.db.insert(accountRefreshTokens).values({
			token: refreshToken,
			accountId,
			expiresAt: refreshExpiresAt,
		});

		return {
			accessToken,
			refreshToken,
			expiresIn: this.parseExpirySeconds(config.ONBOARDING_JWT_EXPIRY),
		};
	}

	async refreshOnboardingToken(refreshToken: string) {
		const [token] = await this.db
			.select()
			.from(accountRefreshTokens)
			.where(
				and(
					eq(accountRefreshTokens.token, refreshToken),
					eq(accountRefreshTokens.revoked, false),
				),
			);
		if (!token) {
			throw new Error('Invalid refresh token');
		}
		if (new Date() > token.expiresAt) {
			throw new Error('Refresh token expired');
		}

		await this.db
			.update(accountRefreshTokens)
			.set({ revoked: true })
			.where(eq(accountRefreshTokens.id, token.id));

		return this.issueOnboardingTokens(token.accountId);
	}

	async issueTeamToken(params: { accountId: string; teamId: string; agentId?: string }) {
		const [membership] = await this.db
			.select()
			.from(users)
			.where(
				and(
					eq(users.accountId, params.accountId),
					eq(users.teamId, params.teamId),
					eq(users.status, 'active'),
				),
			);

		if (!membership) {
			throw new Error('No active membership in team');
		}

		const [account] = await this.db
			.select()
			.from(accounts)
			.where(eq(accounts.id, params.accountId));
		if (!account) {
			throw new Error('Account not found');
		}

		const accessToken = await signJwt({
			sub: membership.id,
			team: membership.teamId,
			role: membership.roleId ?? '',
			account_id: params.accountId,
			agent_id: params.agentId,
			limits_tier: account.limitsTier as 'unverified' | 'verified',
			token_type: 'team',
		});

		return { accessToken, expiresIn: 900, membership };
	}

	async getProfile(accountId: string) {
		const [account] = await this.db
			.select()
			.from(accounts)
			.where(eq(accounts.id, accountId));
		if (!account) return null;

		const memberships = await this.db
			.select()
			.from(users)
			.where(eq(users.accountId, accountId));
		const linkedAgents = await this.db
			.select({
				id: agents.id,
				thumbprint: agents.thumbprint,
				label: agents.label,
				status: agents.status,
				lastSeenAt: agents.lastSeenAt,
				createdAt: agents.createdAt,
			})
			.from(agents)
			.where(eq(agents.accountId, accountId));

		return { account, memberships, agents: linkedAgents };
	}

	private parseExpirySeconds(value: string): number {
		const normalized = value.trim().toLowerCase();
		if (normalized.endsWith('m')) return parseInt(normalized.slice(0, -1), 10) * 60;
		if (normalized.endsWith('h')) return parseInt(normalized.slice(0, -1), 10) * 3600;
		if (normalized.endsWith('d')) return parseInt(normalized.slice(0, -1), 10) * 86400;
		return parseInt(normalized, 10);
	}

	private parseExpiryMs(value: string): number {
		return this.parseExpirySeconds(value) * 1000;
	}
}
