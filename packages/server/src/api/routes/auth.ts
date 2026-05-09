import { Hono } from 'hono';
import { getConfig, isEmailDomainAllowed } from '../../config.js';
import { verifyJwt } from '../../services/auth/jwt.js';
import type { ServiceContainer } from '../../services/index.js';
import { authMiddleware } from '../middleware/auth.js';

const SSO_STATE_TTL_SECONDS = 600;

async function resolveAccountId(c: { get: (key: string) => unknown }, services: ServiceContainer) {
	const accountId = c.get('accountId') as string | undefined;
	if (accountId) return accountId;

	const userId = c.get('userId') as string | undefined;
	if (!userId) return null;

	return services.account.ensureAccountForMembership(userId);
}

export function createAuthRoutes(services: ServiceContainer): Hono {
	const app = new Hono();

	app.post('/agent/challenge', async (c) => {
		const body = await c.req.json();
		const publicKeyJwk = body.publicKeyJwk as Record<string, unknown> | undefined;
		const label = body.label as string | undefined;

		if (!publicKeyJwk) {
			return c.json(
				{ error: { code: 'INVALID_REQUEST', message: 'publicKeyJwk is required' } },
				400,
			);
		}

		const challenge = await services.agentIdentity.createChallenge(publicKeyJwk, label);
		return c.json({ success: true, data: challenge }, 201);
	});

	app.post('/agent/register', async (c) => {
		const body = await c.req.json();
		const challengeId = body.challengeId as string | undefined;
		const publicKeyJwk = body.publicKeyJwk as Record<string, unknown> | undefined;
		const signature = body.signature as string | undefined;
		const createAccountIfMissing = body.createAccountIfMissing !== false;

		if (!challengeId || !publicKeyJwk || !signature) {
			return c.json(
				{
					error: {
						code: 'INVALID_REQUEST',
						message: 'challengeId, publicKeyJwk, and signature are required',
					},
				},
				400,
			);
		}

		try {
			const registration = await services.agentIdentity.registerFromChallenge({
				challengeId,
				publicKeyJwk,
				signature,
				createAccountIfMissing,
			});
			const tokens = await services.agentIdentity.issueOnboardingTokens(
				registration.accountId,
				registration.agentId,
			);

			return c.json(
				{
					success: true,
					data: {
						accountId: registration.accountId,
						agentId: registration.agentId,
						thumbprint: registration.thumbprint,
						accessToken: tokens.accessToken,
						refreshToken: tokens.refreshToken,
						expiresIn: tokens.expiresIn,
						limitsTier: 'unverified',
					},
				},
				201,
			);
		} catch (err) {
			return c.json({ error: { code: 'INVALID_CHALLENGE', message: String(err) } }, 400);
		}
	});

	app.post('/token', async (c) => {
		const body = await c.req.json();
		const grantType = (body.grantType ?? body.grant_type) as string | undefined;

		if (!grantType) {
			return c.json({ error: { code: 'INVALID_REQUEST', message: 'grantType is required' } }, 400);
		}

		if (grantType === 'refresh_token') {
			const refreshToken = body.refreshToken ?? body.refresh_token;
			if (!refreshToken || typeof refreshToken !== 'string') {
				return c.json(
					{ error: { code: 'INVALID_REQUEST', message: 'refreshToken is required' } },
					400,
				);
			}

			try {
				const refreshed = await services.agentIdentity.refreshOnboardingToken(refreshToken);
				return c.json({
					success: true,
					data: {
						accessToken: refreshed.accessToken,
						refreshToken: refreshed.refreshToken,
						expiresIn: refreshed.expiresIn,
					},
				});
			} catch (err) {
				return c.json({ error: { code: 'INVALID_GRANT', message: String(err) } }, 400);
			}
		}

		if (grantType === 'team_switch') {
			const authHeader = c.req.header('Authorization');
			if (!authHeader?.startsWith('Bearer ')) {
				return c.json({ error: { code: 'UNAUTHORIZED', message: 'Missing Bearer token' } }, 401);
			}
			const teamId = body.teamId as string | undefined;
			if (!teamId) {
				return c.json({ error: { code: 'INVALID_REQUEST', message: 'teamId is required' } }, 400);
			}

			try {
				const payload = await verifyJwt(authHeader.slice(7));
				let accountId = (payload.account_id as string) ?? '';
				if (!accountId) {
					accountId =
						(await services.account.ensureAccountForMembership(payload.sub as string)) ?? '';
				}
				if (!accountId) {
					return c.json(
						{ error: { code: 'INVALID_TOKEN', message: 'Account context missing in token' } },
						401,
					);
				}

				const result = await services.agentIdentity.issueTeamToken({
					accountId,
					teamId,
					agentId: payload.agent_id as string | undefined,
				});

				return c.json({
					success: true,
					data: {
						accessToken: result.accessToken,
						expiresIn: result.expiresIn,
						membership: result.membership,
					},
				});
			} catch (err) {
				return c.json({ error: { code: 'INVALID_GRANT', message: String(err) } }, 400);
			}
		}

		return c.json(
			{ error: { code: 'UNSUPPORTED_GRANT_TYPE', message: 'Unsupported grant type' } },
			400,
		);
	});

	app.use('/me', authMiddleware);
	app.get('/me', async (c) => {
		const accountId = await resolveAccountId(c, services);
		if (!accountId) {
			return c.json({ error: { code: 'UNAUTHORIZED', message: 'Account context missing' } }, 401);
		}

		const profile = await services.agentIdentity.getProfile(accountId);
		if (!profile) {
			return c.json({ error: { code: 'NOT_FOUND', message: 'Account not found' } }, 404);
		}

		return c.json({ success: true, data: profile });
	});

	app.use('/email/*', authMiddleware);
	app.post('/email/start', async (c) => {
		const accountId = await resolveAccountId(c, services);
		if (!accountId) {
			return c.json({ error: { code: 'UNAUTHORIZED', message: 'Account context missing' } }, 401);
		}

		const body = await c.req.json();
		const email = body.email as string | undefined;
		if (!email) {
			return c.json({ error: { code: 'INVALID_REQUEST', message: 'email is required' } }, 400);
		}
		if (!isEmailDomainAllowed(email)) {
			return c.json(
				{
					error: {
						code: 'EMAIL_DOMAIN_NOT_ALLOWED',
						message: 'Email domain is not on the allowlist for this server',
					},
				},
				403,
			);
		}

		try {
			const challenge = await services.emailVerification.start(accountId, email);
			return c.json({ success: true, data: challenge }, 201);
		} catch (err) {
			return c.json({ error: { code: 'EMAIL_SEND_FAILED', message: String(err) } }, 400);
		}
	});

	app.post('/email/verify', async (c) => {
		const accountId = await resolveAccountId(c, services);
		if (!accountId) {
			return c.json({ error: { code: 'UNAUTHORIZED', message: 'Account context missing' } }, 401);
		}

		const body = await c.req.json();
		const challengeId = body.challengeId as string | undefined;
		const otp = body.otp as string | undefined;
		if (!challengeId || !otp) {
			return c.json(
				{ error: { code: 'INVALID_REQUEST', message: 'challengeId and otp are required' } },
				400,
			);
		}

		try {
			const account = await services.emailVerification.verify(accountId, challengeId, otp);
			let promotedToSuperAdmin = false;
			if (account?.primaryEmail) {
				promotedToSuperAdmin = await services.bootstrap.maybePromoteByEmail(
					accountId,
					account.primaryEmail,
				);
			}
			return c.json({
				success: true,
				data: {
					verified: true,
					limitsTier: account?.limitsTier ?? 'verified',
					promotedToSuperAdmin,
				},
			});
		} catch (err) {
			return c.json({ error: { code: 'OTP_INVALID', message: String(err) } }, 400);
		}
	});

	app.get('/sso/start', async (c) => {
		if (!services.oidc.isConfigured) {
			return c.json(
				{ error: { code: 'OIDC_NOT_CONFIGURED', message: 'SSO is not configured on this server' } },
				404,
			);
		}
		const config = getConfig();
		const callbackUrl = `${config.PUBLIC_BASE_URL}${config.OIDC_REDIRECT_PATH}`;
		try {
			const start = await services.oidc.start(callbackUrl);
			await services.cache.set(
				`sso:state:${start.state}`,
				{ codeVerifier: start.codeVerifier, nonce: start.nonce },
				SSO_STATE_TTL_SECONDS,
			);
			return c.redirect(start.authUrl, 302);
		} catch (err) {
			return c.json({ error: { code: 'OIDC_START_FAILED', message: String(err) } }, 500);
		}
	});

	app.get('/sso/callback', async (c) => {
		if (!services.oidc.isConfigured) {
			return c.json(
				{ error: { code: 'OIDC_NOT_CONFIGURED', message: 'SSO is not configured on this server' } },
				404,
			);
		}
		const config = getConfig();
		const state = c.req.query('state');
		if (!state) {
			return c.json({ error: { code: 'INVALID_REQUEST', message: 'state is required' } }, 400);
		}
		const stored = await services.cache.get<{ codeVerifier: string; nonce: string }>(
			`sso:state:${state}`,
		);
		if (!stored) {
			return c.json(
				{ error: { code: 'SSO_STATE_EXPIRED', message: 'SSO state not found or expired' } },
				400,
			);
		}
		await services.cache.del(`sso:state:${state}`);

		const callbackUrl = new URL(c.req.url);
		try {
			const profile = await services.oidc.complete({
				callbackUrl,
				state,
				codeVerifier: stored.codeVerifier,
				nonce: stored.nonce,
			});
			if (!profile.email) {
				return c.json(
					{
						error: {
							code: 'OIDC_NO_EMAIL',
							message: 'OIDC provider did not return an email claim',
						},
					},
					400,
				);
			}
			if (!isEmailDomainAllowed(profile.email)) {
				return c.json(
					{
						error: {
							code: 'EMAIL_DOMAIN_NOT_ALLOWED',
							message: 'Email domain is not on the allowlist for this server',
						},
					},
					403,
				);
			}

			const account = await services.account.findOrCreateByEmail(profile.email, {
				markVerified: profile.emailVerified !== false,
			});
			await services.bootstrap.maybePromoteByEmail(account.id, account.primaryEmail);

			const tokens = await services.agentIdentity.issueOnboardingTokens(account.id);

			const webBase = config.WEB_BASE_URL ?? config.PUBLIC_BASE_URL;
			const redirect = new URL(`${webBase.replace(/\/$/, '')}/sso/complete`);
			redirect.searchParams.set('access_token', tokens.accessToken);
			redirect.searchParams.set('refresh_token', tokens.refreshToken);
			redirect.searchParams.set('expires_in', String(tokens.expiresIn));
			return c.redirect(redirect.toString(), 302);
		} catch (err) {
			return c.json({ error: { code: 'OIDC_CALLBACK_FAILED', message: String(err) } }, 400);
		}
	});

	app.get('/setup/status', async (c) => {
		const hasSuper = await services.account.hasAnySuperAdmin();
		return c.json({
			success: true,
			data: {
				hasSuperAdmin: hasSuper,
				bootstrapEmailConfigured: Boolean(process.env.BOOTSTRAP_ADMIN_EMAIL),
			},
		});
	});

	app.use('/setup/redeem', authMiddleware);
	app.post('/setup/redeem', async (c) => {
		const accountId = await resolveAccountId(c, services);
		if (!accountId) {
			return c.json({ error: { code: 'UNAUTHORIZED', message: 'Account context missing' } }, 401);
		}
		const body = await c.req.json();
		const token = body.token as string | undefined;
		if (!token) {
			return c.json({ error: { code: 'INVALID_REQUEST', message: 'token is required' } }, 400);
		}
		const result = await services.bootstrap.redeemSetupToken(token, accountId);
		if (!result.ok) {
			return c.json({ error: { code: 'SETUP_TOKEN_INVALID', message: result.reason } }, 400);
		}
		return c.json({ success: true, data: { promotedToSuperAdmin: true } });
	});

	return app;
}
