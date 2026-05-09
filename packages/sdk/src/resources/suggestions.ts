import type { ApiResponse, FieldSuggestion, SchemaField } from '@agentsync/types';

export class SuggestionResource {
	constructor(private request: <T>(method: string, path: string, body?: unknown) => Promise<T>) {}

	async list(): Promise<ApiResponse<FieldSuggestion[]>> {
		return this.request<ApiResponse<FieldSuggestion[]>>('GET', '/v1/suggestions');
	}

	async suggest(input: {
		tableId: string;
		fieldName: string;
		fieldSlug: string;
		fieldType: string;
		rationale: string;
		exampleValue?: unknown;
	}): Promise<ApiResponse<FieldSuggestion>> {
		return this.request<ApiResponse<FieldSuggestion>>('POST', '/v1/suggestions', input);
	}

	async approve(suggestionId: string, note?: string): Promise<ApiResponse<SchemaField>> {
		return this.request<ApiResponse<SchemaField>>(
			'POST',
			`/v1/suggestions/${suggestionId}/approve`,
			{ note },
		);
	}

	async reject(suggestionId: string, note?: string): Promise<ApiResponse<void>> {
		return this.request<ApiResponse<void>>('POST', `/v1/suggestions/${suggestionId}/reject`, {
			note,
		});
	}
}
