'use server';

import { type ApiResponse, apiFromCookies } from '@/lib/api';

export async function redeemSetupToken(
	token: string,
): Promise<ApiResponse<{ promotedToSuperAdmin: boolean }>> {
	const api = await apiFromCookies();
	return api.post('/v1/auth/setup/redeem', { token });
}
