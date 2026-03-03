import { Hono } from 'hono';
import type { AuthService } from './auth.service.js';
import { logger } from '../../infra/logger.js';

export function createOAuthRoutes(authService: AuthService): Hono {
	const app = new Hono();

	// Authorization endpoint
	app.get('/authorize', async (c) => {
		const params = c.req.query();

		// In a real implementation, this would render a consent screen
		// For now, we'll auto-approve if a valid user session exists
		const clientId = params.client_id;
		const redirectUri = params.redirect_uri;
		const state = params.state;
		const codeChallenge = params.code_challenge;
		const codeChallengeMethod = params.code_challenge_method;
		const scope = params.scope;

		if (!clientId || !redirectUri || !state || !codeChallenge) {
			return c.json({ error: 'invalid_request', error_description: 'Missing required parameters' }, 400);
		}

		// Validate client
		const client = await authService.getOAuthClient(clientId);
		if (!client) {
			return c.json({ error: 'invalid_client' }, 401);
		}

		if (!client.redirectUris.includes(redirectUri)) {
			return c.json({ error: 'invalid_request', error_description: 'Invalid redirect URI' }, 400);
		}

		// Require an explicit authenticated user context instead of auto-approving
		// the first user in the team. A full hosted consent UI can pass user_id here.
		const userId = params.user_id;
		if (!userId) {
			return c.json({
				error: 'interaction_required',
				error_description: 'user_id is required for authorization approval',
			}, 400);
		}

		const { users } = await import('@agentsync/db');
		const { and: andOp, eq: eqOp } = await import('drizzle-orm');

		let userRecord: { id: string } | null = null;
		if (client.teamId) {
			const teamUsers = await (authService as any).db
				.select()
				.from(users)
				.where(
					andOp(
						eqOp(users.id, userId),
						eqOp(users.teamId, client.teamId),
						eqOp(users.status, 'active'),
					),
				)
				.limit(1);
			userRecord = teamUsers[0] ?? null;
		}

		if (!userRecord) {
			return c.json({ error: 'invalid_request', error_description: 'Approved user not found in client team' }, 400);
		}

		const code = await authService.createAuthorizationCode({
			userId: userRecord.id,
			clientId,
			redirectUri,
			scope,
			codeChallenge,
			codeChallengeMethod: codeChallengeMethod ?? 'S256',
		});

		const redirectUrl = new URL(redirectUri);
		redirectUrl.searchParams.set('code', code);
		redirectUrl.searchParams.set('state', state);

		return c.redirect(redirectUrl.toString());
	});

	// Token endpoint
	app.post('/token', async (c) => {
		const body = await c.req.parseBody();
		const grantType = body.grant_type as string;

		try {
			if (grantType === 'authorization_code') {
				const result = await authService.exchangeCode({
					code: body.code as string,
					redirectUri: body.redirect_uri as string,
					clientId: body.client_id as string,
					codeVerifier: body.code_verifier as string,
				});

				return c.json({
					access_token: result.accessToken,
					refresh_token: result.refreshToken,
					token_type: 'Bearer',
					expires_in: result.expiresIn,
				});
			}

			if (grantType === 'refresh_token') {
				const result = await authService.refreshAccessToken({
					refreshToken: body.refresh_token as string,
					clientId: body.client_id as string,
				});

				return c.json({
					access_token: result.accessToken,
					refresh_token: result.refreshToken,
					token_type: 'Bearer',
					expires_in: result.expiresIn,
				});
			}

			if (grantType === 'urn:ietf:params:oauth:grant-type:device_code') {
				const result = await authService.exchangeDeviceCode({
					deviceCode: body.device_code as string,
					clientId: body.client_id as string,
				});

				return c.json({
					access_token: result.accessToken,
					refresh_token: result.refreshToken,
					token_type: 'Bearer',
					expires_in: result.expiresIn,
				});
			}

			return c.json({ error: 'unsupported_grant_type' }, 400);
		} catch (err) {
			logger.error('Token error', { error: String(err) });
			return c.json({ error: 'invalid_grant', error_description: String(err) }, 400);
		}
	});

	// Device Authorization endpoint (RFC 8628 style)
	app.post('/device/authorize', async (c) => {
		const body = await c.req.parseBody();
		const clientId = body.client_id as string | undefined;
		const scope = body.scope as string | undefined;

		if (!clientId) {
			return c.json({ error: 'invalid_request', error_description: 'client_id is required' }, 400);
		}

		try {
			const result = await authService.createDeviceAuthorization({ clientId, scope });
			return c.json({
				device_code: result.deviceCode,
				user_code: result.userCode,
				verification_uri: result.verificationUri,
				expires_in: result.expiresIn,
				interval: result.interval,
			});
		} catch (err) {
			return c.json({ error: 'invalid_client', error_description: String(err) }, 401);
		}
	});

	// Minimal approval endpoint for device flow.
	app.post('/device/verify', async (c) => {
		const body = await c.req.json();
		const userCode = body.user_code as string | undefined;
		const userId = body.user_id as string | undefined;
		if (!userCode || !userId) {
			return c.json({ error: 'invalid_request', error_description: 'user_code and user_id are required' }, 400);
		}

		try {
			await authService.approveDeviceAuthorization({ userCode, userId });
			return c.json({ success: true });
		} catch (err) {
			return c.json({ error: 'invalid_grant', error_description: String(err) }, 400);
		}
	});

	// Revoke endpoint
	app.post('/revoke', async (c) => {
		const body = await c.req.parseBody();
		const token = body.token as string;

		if (token) {
			await authService.revokeToken(token);
		}

		return c.json({ success: true });
	});

	return app;
}
