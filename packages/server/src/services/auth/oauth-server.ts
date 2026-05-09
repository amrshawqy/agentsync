import { roles, users } from '@agentsync/db';
import { eq } from 'drizzle-orm';
import { type Context, Hono } from 'hono';
import { html, raw } from 'hono/html';
import { getConfig } from '../../config.js';
import { logger } from '../../infra/logger.js';
import type { AuthService } from './auth.service.js';
import { explainRolePermissions, renderExplanationLines } from './permission-explainer.js';

export function createOAuthRoutes(authService: AuthService): Hono {
	const app = new Hono();
	const db = (authService as unknown as { db: import('@agentsync/db').Database }).db;

	// Authorization endpoint (HTML consent for browsers; JSON-only for legacy user_id auto-approval).
	app.get('/authorize', async (c) => {
		const params = c.req.query();
		const clientId = params.client_id;
		const redirectUri = params.redirect_uri;
		const state = params.state;
		const codeChallenge = params.code_challenge;
		const codeChallengeMethod = params.code_challenge_method;
		const scope = params.scope;

		if (!clientId || !redirectUri || !state || !codeChallenge) {
			return c.json(
				{ error: 'invalid_request', error_description: 'Missing required parameters' },
				400,
			);
		}

		const client = await authService.getOAuthClient(clientId);
		if (!client) {
			return c.json({ error: 'invalid_client' }, 401);
		}
		if (!client.redirectUris.includes(redirectUri)) {
			return c.json({ error: 'invalid_request', error_description: 'Invalid redirect URI' }, 400);
		}

		// Legacy / programmatic path: user_id supplied → auto-approve in JSON.
		if (params.user_id) {
			return autoApprove({
				c,
				authService,
				db,
				clientId,
				redirectUri,
				state,
				codeChallenge,
				codeChallengeMethod,
				scope,
				userId: params.user_id,
				clientTeamId: client.teamId ?? undefined,
			});
		}

		// HTML consent: user must be signed in via Bearer token (cookie or header).
		// We accept ?token=... in the query to keep the consent screen self-contained
		// when redirected from the web app.
		const token = params.token ?? extractBearer(c.req.header('Authorization'));
		if (!token) {
			return renderSignInRequired(c);
		}

		const { verifyJwt } = await import('./jwt.js');
		let payload: Awaited<ReturnType<typeof verifyJwt>>;
		try {
			payload = await verifyJwt(token);
		} catch {
			return renderSignInRequired(c);
		}
		const userId = (payload.sub as string) ?? '';
		if (!userId) {
			return renderSignInRequired(c);
		}

		const [user] = await db.select().from(users).where(eq(users.id, userId));
		if (!user || user.status !== 'active') {
			return renderSignInRequired(c);
		}

		let permissionLines: string[] = [];
		if (user.roleId) {
			const [role] = await db.select().from(roles).where(eq(roles.id, user.roleId));
			permissionLines = explainRolePermissions(role?.permissions ?? {}).map((l) => {
				const verbs = l.actions.length > 0 ? l.actions.join(' and ') : 'access';
				const base = `${verbs.charAt(0).toUpperCase() + verbs.slice(1)} ${l.scope}`;
				if (l.denied && l.denied.length > 0) return `${base} (cannot ${l.denied.join(', ')})`;
				return base;
			});
			if (permissionLines.length === 0) {
				permissionLines = [renderExplanationLines([])];
			}
		}

		return c.html(
			renderConsentPage({
				appName: client.name,
				scope: scope ?? '',
				permissionLines,
				formAction: '/oauth/authorize/decision',
				hidden: {
					client_id: clientId,
					redirect_uri: redirectUri,
					state,
					code_challenge: codeChallenge,
					code_challenge_method: codeChallengeMethod ?? 'S256',
					scope: scope ?? '',
					user_id: user.id,
					token,
				},
			}),
		);
	});

	// Consent decision (form POST from the HTML page).
	app.post('/authorize/decision', async (c) => {
		const body = await c.req.parseBody();
		const decision = (body.decision as string) ?? 'deny';
		const clientId = body.client_id as string;
		const redirectUri = body.redirect_uri as string;
		const state = body.state as string;
		const codeChallenge = body.code_challenge as string;
		const codeChallengeMethod = (body.code_challenge_method as string) ?? 'S256';
		const scope = (body.scope as string) || undefined;
		const userId = body.user_id as string;
		const token = body.token as string | undefined;

		if (!clientId || !redirectUri || !state || !codeChallenge || !userId || !token) {
			return c.json({ error: 'invalid_request' }, 400);
		}

		// Re-verify signed-in user.
		try {
			const { verifyJwt } = await import('./jwt.js');
			await verifyJwt(token);
		} catch {
			return renderSignInRequired(c);
		}

		if (decision !== 'allow') {
			const denied = new URL(redirectUri);
			denied.searchParams.set('error', 'access_denied');
			denied.searchParams.set('state', state);
			return c.redirect(denied.toString());
		}

		const code = await authService.createAuthorizationCode({
			userId,
			clientId,
			redirectUri,
			scope,
			codeChallenge,
			codeChallengeMethod,
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
					clientSecret: body.client_secret as string | undefined,
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
			return c.json(
				{ error: 'invalid_request', error_description: 'user_code and user_id are required' },
				400,
			);
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

	// Dynamic Client Registration (RFC 7591) — required for MCP discoverability.
	app.post('/register', async (c) => {
		const body = (await c.req.json().catch(() => ({}))) as {
			client_name?: string;
			redirect_uris?: string[];
			token_endpoint_auth_method?: string;
		};
		const clientName = body.client_name?.toString().trim() || 'MCP Client';
		const redirectUris = Array.isArray(body.redirect_uris) ? body.redirect_uris : [];
		if (
			redirectUris.length === 0 ||
			redirectUris.some((u) => typeof u !== 'string' || !/^https?:\/\//.test(u))
		) {
			return c.json(
				{
					error: 'invalid_redirect_uri',
					error_description: 'redirect_uris must be a non-empty list of http(s) URLs',
				},
				400,
			);
		}
		const isPublic =
			(body.token_endpoint_auth_method ?? 'none').toString().toLowerCase() === 'none';

		const created = await authService.registerDynamicClient({
			clientName,
			redirectUris,
			isPublic,
		});

		return c.json(
			{
				client_id: created.clientId,
				client_secret: created.clientSecret,
				client_id_issued_at: created.clientIdIssuedAt,
				redirect_uris: created.redirectUris,
				token_endpoint_auth_method: created.tokenEndpointAuthMethod,
				grant_types: ['authorization_code', 'refresh_token'],
				response_types: ['code'],
			},
			201,
		);
	});

	return app;
}

function extractBearer(header: string | undefined): string | undefined {
	if (!header) return undefined;
	if (!header.startsWith('Bearer ')) return undefined;
	return header.slice(7);
}

async function autoApprove(args: {
	c: Context;
	authService: AuthService;
	db: import('@agentsync/db').Database;
	clientId: string;
	redirectUri: string;
	state: string;
	codeChallenge: string;
	codeChallengeMethod?: string;
	scope?: string;
	userId: string;
	clientTeamId?: string;
}) {
	let userRecord: { id: string } | null = null;
	if (args.clientTeamId) {
		const teamUsers = await args.db.select().from(users).where(eq(users.id, args.userId));
		userRecord = teamUsers[0]?.teamId === args.clientTeamId ? teamUsers[0] : null;
	}
	if (!userRecord) {
		return args.c.json(
			{ error: 'invalid_request', error_description: 'Approved user not found in client team' },
			400,
		);
	}

	const code = await args.authService.createAuthorizationCode({
		userId: userRecord.id,
		clientId: args.clientId,
		redirectUri: args.redirectUri,
		scope: args.scope,
		codeChallenge: args.codeChallenge,
		codeChallengeMethod: args.codeChallengeMethod ?? 'S256',
	});

	const redirectUrl = new URL(args.redirectUri);
	redirectUrl.searchParams.set('code', code);
	redirectUrl.searchParams.set('state', args.state);
	return args.c.redirect(redirectUrl.toString());
}

function renderSignInRequired(c: Context) {
	const config = getConfig();
	const signInUrl = `${config.WEB_BASE_URL ?? config.PUBLIC_BASE_URL}/sign-in?return_to=${encodeURIComponent(c.req.url)}`;
	return c.html(html`
		<!doctype html>
		<html lang="en">
			<head>
				<meta charset="utf-8" />
				<title>Sign in required</title>
				<meta name="viewport" content="width=device-width,initial-scale=1" />
				<style>${baseStyles()}</style>
			</head>
			<body>
				<main class="card">
					<h1>Sign in to continue</h1>
					<p>You need to sign in to AgentSync before you can authorize an application.</p>
					<a class="btn primary" href="${signInUrl}">Sign in</a>
				</main>
			</body>
		</html>
	`);
}

function renderConsentPage(args: {
	appName: string;
	scope: string;
	permissionLines: string[];
	formAction: string;
	hidden: Record<string, string>;
}) {
	const hiddenInputs = Object.entries(args.hidden)
		.map(([k, v]) => `<input type="hidden" name="${escapeHtml(k)}" value="${escapeHtml(v)}" />`)
		.join('');
	const bullets = (
		args.permissionLines.length > 0
			? args.permissionLines
			: ['Access your AgentSync data on your behalf']
	)
		.map((l) => `<li>${escapeHtml(l)}</li>`)
		.join('');

	return html`
		<!doctype html>
		<html lang="en">
			<head>
				<meta charset="utf-8" />
				<title>Authorize ${escapeHtml(args.appName)}</title>
				<meta name="viewport" content="width=device-width,initial-scale=1" />
				<style>${baseStyles()}</style>
			</head>
			<body>
				<main class="card">
					<h1>Authorize <span class="hl">${escapeHtml(args.appName)}</span></h1>
					<p class="lead">${escapeHtml(args.appName)} is requesting access to AgentSync as you.</p>
					<h2>What it can do</h2>
					<ul>${raw(bullets)}</ul>
					${args.scope ? html`<p class="muted">Scope: <code>${escapeHtml(args.scope)}</code></p>` : html``}
					<form method="post" action="${args.formAction}">
						${raw(hiddenInputs)}
						<div class="actions">
							<button type="submit" name="decision" value="deny" class="btn ghost">Deny</button>
							<button type="submit" name="decision" value="allow" class="btn primary">Allow</button>
						</div>
					</form>
				</main>
			</body>
		</html>
	`;
}

function escapeHtml(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

function baseStyles() {
	return raw(`
		:root { color-scheme: light dark; --bg:#f8fafc; --card:#fff; --fg:#0f172a; --muted:#64748b; --primary:#2563eb; --border:#e2e8f0; }
		@media (prefers-color-scheme: dark) { :root { --bg:#0b1220; --card:#0f172a; --fg:#e2e8f0; --muted:#94a3b8; --border:#1e293b; } }
		* { box-sizing: border-box; }
		body { font: 16px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; background: var(--bg); color: var(--fg); margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 32px 16px; }
		.card { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 32px; max-width: 520px; width: 100%; box-shadow: 0 4px 24px rgba(15,23,42,.08); }
		h1 { margin: 0 0 8px; font-size: 22px; }
		h2 { font-size: 14px; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); margin: 24px 0 8px; }
		.hl { color: var(--primary); }
		.lead { margin: 0 0 16px; color: var(--muted); }
		.muted { color: var(--muted); font-size: 13px; }
		ul { padding-left: 20px; margin: 0 0 16px; }
		li { margin: 6px 0; }
		.actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 24px; }
		.btn { padding: 10px 18px; border-radius: 8px; border: 1px solid var(--border); cursor: pointer; font-size: 14px; }
		.btn.primary { background: var(--primary); color: #fff; border-color: var(--primary); }
		.btn.ghost { background: transparent; color: var(--fg); }
		code { background: rgba(148, 163, 184, .15); padding: 2px 6px; border-radius: 4px; font-size: 13px; }
		a.btn { display: inline-block; text-decoration: none; }
	`);
}
