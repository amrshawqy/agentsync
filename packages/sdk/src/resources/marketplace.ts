import type { ApiResponse, Blueprint, BlueprintReview } from '@agentsync/types';

export class MarketplaceResource {
	constructor(private request: <T>(method: string, path: string, body?: unknown) => Promise<T>) {}

	async search(params?: {
		query?: string;
		category?: string;
		tags?: string[];
		limit?: number;
		offset?: number;
	}): Promise<ApiResponse<Blueprint[]>> {
		const searchParams = new URLSearchParams();
		if (params?.query) searchParams.set('q', params.query);
		if (params?.category) searchParams.set('category', params.category);
		if (params?.tags) searchParams.set('tags', params.tags.join(','));
		if (params?.limit) searchParams.set('limit', String(params.limit));
		if (params?.offset) searchParams.set('offset', String(params.offset));

		const qs = searchParams.toString();
		return this.request<ApiResponse<Blueprint[]>>(
			'GET',
			`/v1/marketplace/search${qs ? `?${qs}` : ''}`,
		);
	}

	async submitReview(input: {
		blueprintId: string;
		rating: number;
		title?: string;
		body?: string;
	}): Promise<ApiResponse<BlueprintReview>> {
		return this.request<ApiResponse<BlueprintReview>>(
			'POST',
			`/v1/marketplace/blueprints/${input.blueprintId}/reviews`,
			{
				rating: input.rating,
				title: input.title,
				body: input.body,
			},
		);
	}

	async listReviews(blueprintId: string): Promise<ApiResponse<BlueprintReview[]>> {
		return this.request<ApiResponse<BlueprintReview[]>>(
			'GET',
			`/v1/marketplace/blueprints/${blueprintId}/reviews`,
		);
	}
}
