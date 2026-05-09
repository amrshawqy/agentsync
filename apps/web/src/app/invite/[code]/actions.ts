'use server';

import { type ApiResponse, apiFromCookies, cookieNames } from '@/lib/api';
import { cookies } from 'next/headers';

interface AcceptResponse {
	teamId: string;
	accessToken: string;
}

export async function acceptInvite(inviteCode: string): Promise<ApiResponse<AcceptResponse>> {
	const api = await apiFromCookies();
	const result = await api.post<AcceptResponse>('/v1/teams/invites/accept', { inviteCode });
	if ('success' in result) {
		const store = await cookies();
		store.set(cookieNames.session, result.data.accessToken, {
			httpOnly: true,
			secure: process.env.NODE_ENV === 'production',
			sameSite: 'lax',
			maxAge: 3600,
			path: '/',
		});
	}
	return result;
}
