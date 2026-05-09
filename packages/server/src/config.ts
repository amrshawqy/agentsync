import { z } from 'zod';

const ConfigSchema = z.object({
	// Database
	DATABASE_URL: z.string().default('postgresql://agentsync:agentsync@localhost:5432/agentsync'),

	// Redis
	REDIS_URL: z.string().default('redis://localhost:6379'),

	// Auth
	JWT_SECRET: z.string().default('change-me-in-production'),
	JWT_ISSUER: z.string().default('agentsync'),
	JWT_AUDIENCE: z.string().default('agentsync-api'),
	JWT_EXPIRY: z.string().default('15m'),
	REFRESH_TOKEN_EXPIRY: z.string().default('7d'),

	// OAuth
	OAUTH_CLIENT_ID: z.string().default('agentsync-default'),
	OAUTH_CLIENT_SECRET: z.string().default('change-me-in-production'),
	PUBLIC_BASE_URL: z.string().default('http://localhost:3000'),

	// Agent-native onboarding and limits
	ONBOARDING_JWT_EXPIRY: z.string().default('1h'),
	ONBOARDING_REFRESH_EXPIRY: z.string().default('30d'),
	UNVERIFIED_MAX_TEAMS: z.coerce.number().int().min(1).default(1),
	UNVERIFIED_MAX_INVITES_PER_DAY: z.coerce.number().int().min(0).default(3),
	VERIFIED_MAX_INVITES_PER_DAY: z.coerce.number().int().min(0).default(100),
	EMAIL_OTP_EXPIRY_MINUTES: z.coerce.number().int().min(1).default(10),
	EMAIL_OTP_MAX_ATTEMPTS: z.coerce.number().int().min(1).default(5),

	// Email delivery — pluggable provider (console for dev; resend/smtp/ses for prod)
	EMAIL_PROVIDER: z.enum(['console', 'resend', 'smtp', 'ses']).default('console'),
	EMAIL_FROM: z.string().optional(),

	// Resend
	RESEND_API_KEY: z.string().optional(),

	// SMTP
	SMTP_HOST: z.string().optional(),
	SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
	SMTP_SECURE: z.coerce.boolean().default(false),
	SMTP_USER: z.string().optional(),
	SMTP_PASSWORD: z.string().optional(),

	// AWS SES
	SES_REGION: z.string().default('us-east-1'),
	SES_ACCESS_KEY_ID: z.string().optional(),
	SES_SECRET_ACCESS_KEY: z.string().optional(),

	// Self-host bootstrap & access control
	BOOTSTRAP_ADMIN_EMAIL: z.string().optional(),
	SIGNUP_ALLOWED_DOMAINS: z.string().optional(),

	// OIDC SSO (Phase 1)
	OIDC_ISSUER: z.string().optional(),
	OIDC_CLIENT_ID: z.string().optional(),
	OIDC_CLIENT_SECRET: z.string().optional(),
	OIDC_SCOPES: z.string().default('openid email profile'),
	OIDC_REDIRECT_PATH: z.string().default('/v1/auth/sso/callback'),
	WEB_BASE_URL: z.string().optional(),

	// Anthropic (optional, powers describe-what-you-track wizard)
	ANTHROPIC_API_KEY: z.string().optional(),

	// Server
	PORT: z.coerce.number().default(3000),
	HOST: z.string().default('0.0.0.0'),
	NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
	LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('debug'),

	// MCP
	MCP_SERVER_NAME: z.string().default('agentsync'),
	MCP_SERVER_VERSION: z.string().default('0.1.0'),

	// Webhook / SSRF protection
	WEBHOOK_ALLOW_HTTP: z.coerce.boolean().default(false),
	WEBHOOK_ALLOWED_HOSTS: z.string().optional(),
	WEBHOOK_BLOCKED_HOSTS: z.string().optional(),
	WEBHOOK_BLOCKED_CIDRS: z.string().optional(),

	// S3/R2 Object Storage (optional — storage disabled if not configured)
	S3_BUCKET: z.string().optional(),
	S3_REGION: z.string().default('us-east-1'),
	S3_ENDPOINT: z.string().optional(),
	S3_ACCESS_KEY_ID: z.string().optional(),
	S3_SECRET_ACCESS_KEY: z.string().optional(),
});

export type Config = z.infer<typeof ConfigSchema>;

let _config: Config | null = null;

export function getConfig(): Config {
	if (!_config) {
		_config = ConfigSchema.parse(process.env);
	}
	return _config;
}

export interface WebhookUrlConfig {
	allowHttp: boolean;
	allowedHosts: string[];
	blockedHosts: string[];
	blockedCidrs: string[];
}

export function getAllowedSignupDomains(): string[] {
	const config = getConfig();
	if (!config.SIGNUP_ALLOWED_DOMAINS) return [];
	return config.SIGNUP_ALLOWED_DOMAINS.split(',')
		.map((d) => d.trim().toLowerCase())
		.filter((d) => d.length > 0);
}

export function isEmailDomainAllowed(email: string): boolean {
	const allowed = getAllowedSignupDomains();
	if (allowed.length === 0) return true;
	const domain = email.split('@')[1]?.toLowerCase();
	if (!domain) return false;
	return allowed.includes(domain);
}

export function getWebhookUrlConfig(): WebhookUrlConfig {
	const config = getConfig();
	return {
		allowHttp:
			config.WEBHOOK_ALLOW_HTTP || config.NODE_ENV === 'development' || config.NODE_ENV === 'test',
		allowedHosts: config.WEBHOOK_ALLOWED_HOSTS
			? config.WEBHOOK_ALLOWED_HOSTS.split(',').map((h) => h.trim())
			: [],
		blockedHosts: config.WEBHOOK_BLOCKED_HOSTS
			? config.WEBHOOK_BLOCKED_HOSTS.split(',').map((h) => h.trim())
			: [],
		blockedCidrs: config.WEBHOOK_BLOCKED_CIDRS
			? config.WEBHOOK_BLOCKED_CIDRS.split(',').map((c) => c.trim())
			: [],
	};
}
