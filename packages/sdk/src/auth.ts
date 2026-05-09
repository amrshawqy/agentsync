import { createHash, randomBytes } from 'node:crypto';

export interface OAuthConfig {
	serverUrl: string;
	clientId: string;
	redirectUri: string;
	scopes?: string[];
}

export interface TokenSet {
	accessToken: string;
	refreshToken: string;
	expiresAt: number;
}

export interface DeviceAuthorization {
	deviceCode: string;
	userCode: string;
	verificationUri: string;
	expiresIn: number;
	interval: number;
}

export class OAuthHelper {
	private config: OAuthConfig;
	private tokenSet: TokenSet | null = null;

	constructor(config: OAuthConfig) {
		this.config = config;
	}

	generatePKCE(): { verifier: string; challenge: string } {
		const verifier = randomBytes(32).toString('base64url');
		const challenge = createHash('sha256').update(verifier).digest('base64url');
		return { verifier, challenge };
	}

	getAuthorizationUrl(state: string, pkceChallenge: string): string {
		const params = new URLSearchParams({
			response_type: 'code',
			client_id: this.config.clientId,
			redirect_uri: this.config.redirectUri,
			state,
			code_challenge: pkceChallenge,
			code_challenge_method: 'S256',
		});

		if (this.config.scopes?.length) {
			params.set('scope', this.config.scopes.join(' '));
		}

		return `${this.config.serverUrl}/oauth/authorize?${params}`;
	}

	async exchangeCode(code: string, codeVerifier: string): Promise<TokenSet> {
		const response = await fetch(`${this.config.serverUrl}/oauth/token`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({
				grant_type: 'authorization_code',
				code,
				redirect_uri: this.config.redirectUri,
				client_id: this.config.clientId,
				code_verifier: codeVerifier,
			}),
		});

		if (!response.ok) {
			throw new Error(`Token exchange failed: ${response.status}`);
		}

		const data = (await response.json()) as any;
		this.tokenSet = {
			accessToken: data.access_token,
			refreshToken: data.refresh_token,
			expiresAt: Date.now() + data.expires_in * 1000,
		};

		return this.tokenSet;
	}

	async startDeviceAuthorization(): Promise<DeviceAuthorization> {
		const response = await fetch(`${this.config.serverUrl}/oauth/device/authorize`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({
				client_id: this.config.clientId,
				scope: this.config.scopes?.join(' ') ?? '',
			}),
		});

		if (!response.ok) {
			throw new Error(`Device authorization failed: ${response.status}`);
		}

		const data = (await response.json()) as any;
		return {
			deviceCode: data.device_code,
			userCode: data.user_code,
			verificationUri: data.verification_uri,
			expiresIn: data.expires_in,
			interval: data.interval ?? 5,
		};
	}

	async pollDeviceToken(
		deviceCode: string,
		intervalSeconds = 5,
		timeoutMs = 5 * 60_000,
	): Promise<TokenSet> {
		const deadline = Date.now() + timeoutMs;

		while (Date.now() < deadline) {
			const response = await fetch(`${this.config.serverUrl}/oauth/token`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
				body: new URLSearchParams({
					grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
					device_code: deviceCode,
					client_id: this.config.clientId,
				}),
			});

			if (response.ok) {
				const data = (await response.json()) as any;
				this.tokenSet = {
					accessToken: data.access_token,
					refreshToken: data.refresh_token,
					expiresAt: Date.now() + data.expires_in * 1000,
				};
				return this.tokenSet;
			}

			const body = await response.json().catch(() => ({}));
			if (
				body?.error === 'invalid_grant' &&
				String(body?.error_description ?? '').includes('authorization_pending')
			) {
				await new Promise((resolve) => setTimeout(resolve, intervalSeconds * 1000));
				continue;
			}

			throw new Error(`Device token polling failed: ${response.status}`);
		}

		throw new Error('Device authorization polling timed out');
	}

	async refreshToken(): Promise<TokenSet> {
		if (!this.tokenSet?.refreshToken) {
			throw new Error('No refresh token available');
		}

		const response = await fetch(`${this.config.serverUrl}/oauth/token`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({
				grant_type: 'refresh_token',
				refresh_token: this.tokenSet.refreshToken,
				client_id: this.config.clientId,
			}),
		});

		if (!response.ok) {
			throw new Error(`Token refresh failed: ${response.status}`);
		}

		const data = (await response.json()) as any;
		this.tokenSet = {
			accessToken: data.access_token,
			refreshToken: data.refresh_token,
			expiresAt: Date.now() + data.expires_in * 1000,
		};

		return this.tokenSet;
	}

	async getAccessToken(): Promise<string> {
		if (!this.tokenSet) throw new Error('Not authenticated');

		if (Date.now() >= this.tokenSet.expiresAt - 60000) {
			await this.refreshToken();
		}

		return this.tokenSet?.accessToken;
	}

	setTokens(tokenSet: TokenSet): void {
		this.tokenSet = tokenSet;
	}

	isAuthenticated(): boolean {
		return this.tokenSet !== null;
	}
}
