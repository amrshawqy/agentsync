'use server';

import { ApiClient } from '@/lib/api';
import { redirect } from 'next/navigation';

/**
 * Email sign-in flow:
 *  1. Server registers an anonymous agent identity to obtain an onboarding token.
 *  2. Server starts an OTP challenge using that token.
 *  3. User receives the OTP and enters it on /sign-in/verify.
 *
 * For pure email/password we'd need a different endpoint; for now we reuse the
 * email-OTP flow which already exists on the server.
 */
export async function startEmailFlow(
	formData: FormData,
): Promise<{ error?: string; sent?: boolean }> {
	const email = String(formData.get('email') ?? '').trim();
	if (!email) return { error: 'email is required' };

	// Mint an ephemeral onboarding identity for OTP delivery.
	const api = new ApiClient();
	const challenge = await api.post('/v1/auth/agent/challenge', {
		publicKeyJwk: { kty: 'oct', k: 'placeholder' },
		label: `web-${email}`,
	});
	if ('error' in challenge) return { error: challenge.error.message };

	// We can't actually sign without a real keypair from the browser, so the
	// email-magic-link flow is implemented separately on the server in Phase 4.
	// For Phase 2, encourage users to use SSO; if they reach here without SSO
	// they can use the agent-driven onboarding instead.
	void challenge;
	return {
		error:
			'Email sign-in requires SSO or an agent-driven onboarding. Configure OIDC or use an MCP-capable agent.',
	};
}

export async function signOut() {
	redirect('/');
}
