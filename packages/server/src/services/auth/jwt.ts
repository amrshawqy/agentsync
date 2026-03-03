import * as jose from 'jose';
import { getConfig } from '../../config.js';

export interface JwtPayload {
	sub: string;
	team?: string;
	role?: string;
	scopes?: string;
	account_id?: string;
	agent_id?: string;
	limits_tier?: 'unverified' | 'verified';
	token_type?: 'team' | 'onboarding';
	[key: string]: unknown;
}

let _secret: Uint8Array | null = null;

function getSecret(): Uint8Array {
	if (!_secret) {
		const config = getConfig();
		_secret = new TextEncoder().encode(config.JWT_SECRET);
	}
	return _secret;
}

export async function signJwt(payload: JwtPayload, expiresIn?: string): Promise<string> {
	const config = getConfig();
	return new jose.SignJWT(payload)
		.setProtectedHeader({ alg: 'HS256' })
		.setIssuedAt()
		.setIssuer(config.JWT_ISSUER)
		.setAudience(config.JWT_AUDIENCE)
		.setExpirationTime(expiresIn ?? config.JWT_EXPIRY)
		.sign(getSecret());
}

export async function verifyJwt(token: string): Promise<JwtPayload> {
	const config = getConfig();
	const { payload } = await jose.jwtVerify(token, getSecret(), {
		issuer: config.JWT_ISSUER,
		audience: config.JWT_AUDIENCE,
	});
	return payload as JwtPayload;
}
