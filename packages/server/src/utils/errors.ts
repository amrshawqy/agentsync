/**
 * Maps internal error codes to plain-English messages and optional hints.
 * Used by the API error handler (and consumed verbatim by the web app).
 */
const ERROR_CATALOG: Record<string, { message: string; hint?: string; status: number }> = {
	UNAUTHORIZED: {
		message: 'You need to sign in to do that.',
		status: 401,
	},
	INVALID_TOKEN: {
		message: 'Your session has expired or is invalid.',
		hint: 'Sign in again to continue.',
		status: 401,
	},
	FORBIDDEN: {
		message: "You don't have permission for that action.",
		hint: 'Ask your team admin if you think this is a mistake.',
		status: 403,
	},
	NOT_FOUND: {
		message: "We couldn't find what you were looking for.",
		status: 404,
	},
	VALIDATION_ERROR: {
		message: 'Some of the values you sent were invalid.',
		hint: 'Check the highlighted fields and try again.',
		status: 400,
	},
	RATE_LIMITED: {
		message: "You're going a little fast — try again in a moment.",
		status: 429,
	},
	EMAIL_DOMAIN_NOT_ALLOWED: {
		message: 'This server only allows accounts from approved email domains.',
		hint: 'Ask your IT admin to add your domain to the allowlist.',
		status: 403,
	},
	OIDC_NOT_CONFIGURED: {
		message: 'Single sign-on is not enabled on this server.',
		status: 404,
	},
	BLUEPRINT_DRAFT_DISABLED: {
		message: 'AI blueprint drafting is not enabled on this server.',
		hint: 'An admin can enable it by setting ANTHROPIC_API_KEY.',
		status: 404,
	},
	INVALID_TRANSITION: {
		message: 'That status change is not allowed by the schema.',
		status: 400,
	},
	REVERT_FAILED: {
		message: "We couldn't revert that record.",
		status: 400,
	},
	SETUP_TOKEN_INVALID: {
		message: 'That setup token is invalid, expired, or already used.',
		hint: 'Restart the server to mint a new token, or set BOOTSTRAP_ADMIN_EMAIL.',
		status: 400,
	},
};

export function explainError(code: string, fallbackMessage?: string) {
	const entry = ERROR_CATALOG[code];
	if (entry) {
		return { code, ...entry };
	}
	return {
		code,
		message: fallbackMessage ?? 'Something went wrong.',
		status: 500,
	};
}
