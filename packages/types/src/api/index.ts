import { z } from 'zod';

// Pagination
export const PaginationSchema = z.object({
	limit: z.number().int().min(1).max(1000).default(50),
	offset: z.number().int().min(0).default(0),
});

export type Pagination = z.infer<typeof PaginationSchema>;

export const PaginatedResponseSchema = <T extends z.ZodType>(itemSchema: T) =>
	z.object({
		data: z.array(itemSchema),
		total: z.number().int(),
		limit: z.number().int(),
		offset: z.number().int(),
		hasMore: z.boolean(),
	});

export interface PaginatedResponse<T> {
	data: T[];
	total: number;
	limit: number;
	offset: number;
	hasMore: boolean;
}

// API Response wrapper
export interface ApiResponse<T> {
	success: boolean;
	data?: T;
	error?: {
		code: string;
		message: string;
		details?: Record<string, unknown>;
	};
}

// Auth types
export const LoginRequestSchema = z.object({
	email: z.string().email(),
	password: z.string().min(8),
});

export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const TokenResponseSchema = z.object({
	accessToken: z.string(),
	refreshToken: z.string(),
	tokenType: z.literal('Bearer'),
	expiresIn: z.number().int(),
});

export type TokenResponse = z.infer<typeof TokenResponseSchema>;

export const RefreshTokenRequestSchema = z.object({
	refreshToken: z.string(),
});

export type RefreshTokenRequest = z.infer<typeof RefreshTokenRequestSchema>;

// OAuth types
export const OAuthAuthorizeRequestSchema = z.object({
	responseType: z.literal('code'),
	clientId: z.string(),
	redirectUri: z.string().url(),
	scope: z.string().optional(),
	state: z.string(),
	codeChallenge: z.string(),
	codeChallengeMethod: z.literal('S256'),
});

export type OAuthAuthorizeRequest = z.infer<typeof OAuthAuthorizeRequestSchema>;

export const OAuthTokenRequestSchema = z.discriminatedUnion('grantType', [
	z.object({
		grantType: z.literal('authorization_code'),
		code: z.string(),
		redirectUri: z.string().url(),
		clientId: z.string(),
		codeVerifier: z.string(),
	}),
	z.object({
		grantType: z.literal('refresh_token'),
		refreshToken: z.string(),
		clientId: z.string(),
	}),
]);

export type OAuthTokenRequest = z.infer<typeof OAuthTokenRequestSchema>;

// Health check
export const HealthResponseSchema = z.object({
	status: z.enum(['ok', 'degraded', 'down']),
	version: z.string(),
	uptime: z.number(),
	services: z.object({
		database: z.enum(['ok', 'down']),
		redis: z.enum(['ok', 'down']),
	}),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;

// Agent-native auth onboarding
export const AgentChallengeRequestSchema = z.object({
	publicKeyJwk: z.record(z.unknown()),
	label: z.string().max(255).optional(),
});
export type AgentChallengeRequest = z.infer<typeof AgentChallengeRequestSchema>;

export const AgentChallengeResponseSchema = z.object({
	challengeId: z.string().uuid(),
	challenge: z.string(),
	expiresAt: z.coerce.date(),
});
export type AgentChallengeResponse = z.infer<typeof AgentChallengeResponseSchema>;

export const AgentRegisterRequestSchema = z.object({
	challengeId: z.string().uuid(),
	publicKeyJwk: z.record(z.unknown()),
	signature: z.string(),
	createAccountIfMissing: z.boolean().default(true),
});
export type AgentRegisterRequest = z.infer<typeof AgentRegisterRequestSchema>;

export const EmailOtpStartRequestSchema = z.object({
	email: z.string().email().max(255),
});
export type EmailOtpStartRequest = z.infer<typeof EmailOtpStartRequestSchema>;

export const EmailOtpVerifyRequestSchema = z.object({
	challengeId: z.string().uuid(),
	otp: z.string().regex(/^\d{6}$/),
});
export type EmailOtpVerifyRequest = z.infer<typeof EmailOtpVerifyRequestSchema>;
