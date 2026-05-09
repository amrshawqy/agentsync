'use server';

import { apiFromCookies, isOk } from '@/lib/api';

export async function createInvite({
	email,
	roleId,
}: {
	email: string;
	roleId: string;
}): Promise<{ ok: boolean; link?: string; error?: string }> {
	const api = await apiFromCookies();
	const me = await api.get<{ teams?: Array<{ id: string }> }>('/v1/auth/me');
	if (!isOk(me)) return { ok: false, error: 'not authenticated' };

	const memberships = await api.get<Array<{ teamId: string }>>('/v1/auth/me');
	void memberships;
	const teamId = (me.data as any).teamId ?? (me.data as any).teams?.[0]?.id;
	if (!teamId) return { ok: false, error: 'no team in session' };

	const result = await api.post<{ inviteCode?: string; inviteLink?: string }>(
		`/v1/teams/${teamId}/invites`,
		{ email, roleId },
	);
	if (!isOk(result)) return { ok: false, error: result.error.message };
	const link = (result.data as any).inviteLink ?? null;
	return { ok: true, link: link ?? undefined };
}
