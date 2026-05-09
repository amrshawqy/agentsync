'use server';

import { type ApiResponse, apiFromCookies } from '@/lib/api';

export async function deployBlueprint(slug: string): Promise<ApiResponse<unknown>> {
	const api = await apiFromCookies();
	return api.post(`/v1/blueprints/${slug}/deploy`, { includeSeedData: true });
}
