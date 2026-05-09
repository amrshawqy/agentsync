'use server';

import { apiFromCookies, isOk } from '@/lib/api';
import { redirect } from 'next/navigation';

export async function draftBlueprint(description: string) {
	const api = await apiFromCookies();
	const result = await api.post<unknown>('/v1/blueprints/draft-from-description', { description });
	if (!isOk(result)) return { ok: false as const, error: result.error.message };
	return { ok: true as const, data: result.data as any };
}

export async function deployDraftBlueprint(draft: any) {
	const api = await apiFromCookies();
	// Save the blueprint, then deploy.
	const created = await api.post<{ slug: string }>('/v1/blueprints', draft);
	if (!isOk(created)) return { ok: false as const, error: created.error.message };
	const deployed = await api.post(`/v1/blueprints/${created.data.slug}/deploy`, {
		includeSeedData: false,
	});
	if (!isOk(deployed)) return { ok: false as const, error: deployed.error.message };
	redirect('/app');
}
