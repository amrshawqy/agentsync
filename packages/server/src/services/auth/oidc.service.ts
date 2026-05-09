import * as oidc from 'openid-client';
import { getConfig } from '../../config.js';
import { logger } from '../../infra/logger.js';

export interface OidcUserInfo {
	sub: string;
	email?: string;
	emailVerified?: boolean;
	name?: string;
	picture?: string;
}

export interface OidcStartResult {
	authUrl: string;
	state: string;
	codeVerifier: string;
	nonce: string;
}

/** Wraps openid-client v6 functional API. Lazily resolves the OIDC issuer config. */
export class OidcService {
	private configPromise: Promise<oidc.Configuration> | null = null;

	get isConfigured(): boolean {
		const c = getConfig();
		return Boolean(c.OIDC_ISSUER && c.OIDC_CLIENT_ID);
	}

	private async getOidcConfig(): Promise<oidc.Configuration> {
		const c = getConfig();
		if (!c.OIDC_ISSUER || !c.OIDC_CLIENT_ID) {
			throw new Error('OIDC is not configured (missing OIDC_ISSUER or OIDC_CLIENT_ID)');
		}
		if (!this.configPromise) {
			this.configPromise = oidc
				.discovery(new URL(c.OIDC_ISSUER), c.OIDC_CLIENT_ID, c.OIDC_CLIENT_SECRET)
				.catch((err) => {
					this.configPromise = null;
					throw err;
				});
		}
		return this.configPromise;
	}

	async start(redirectUri: string): Promise<OidcStartResult> {
		const config = await this.getOidcConfig();
		const c = getConfig();
		const codeVerifier = oidc.randomPKCECodeVerifier();
		const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier);
		const state = oidc.randomState();
		const nonce = oidc.randomNonce();

		const authUrl = oidc.buildAuthorizationUrl(config, {
			redirect_uri: redirectUri,
			scope: c.OIDC_SCOPES,
			code_challenge: codeChallenge,
			code_challenge_method: 'S256',
			state,
			nonce,
		});

		return {
			authUrl: authUrl.toString(),
			state,
			codeVerifier,
			nonce,
		};
	}

	async complete(params: {
		callbackUrl: URL;
		state: string;
		codeVerifier: string;
		nonce: string;
	}): Promise<OidcUserInfo> {
		const config = await this.getOidcConfig();
		try {
			const tokens = await oidc.authorizationCodeGrant(config, params.callbackUrl, {
				expectedState: params.state,
				expectedNonce: params.nonce,
				pkceCodeVerifier: params.codeVerifier,
			});

			const claims = tokens.claims();
			if (!claims) {
				throw new Error('OIDC id_token has no claims');
			}

			const userinfo = tokens.access_token
				? await oidc.fetchUserInfo(config, tokens.access_token, claims.sub)
				: null;

			return {
				sub: claims.sub,
				email: (userinfo?.email ?? (claims.email as string | undefined)) as string | undefined,
				emailVerified: (userinfo?.email_verified ?? claims.email_verified) as boolean | undefined,
				name: (userinfo?.name ?? (claims.name as string | undefined)) as string | undefined,
				picture: (userinfo?.picture ?? (claims.picture as string | undefined)) as
					| string
					| undefined,
			};
		} catch (err) {
			logger.error('OIDC callback failed', { error: String(err) });
			throw err;
		}
	}
}
