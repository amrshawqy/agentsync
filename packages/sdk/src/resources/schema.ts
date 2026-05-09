import type { ApiResponse, SchemaField, SchemaOverview, SchemaTable } from '@agentsync/types';

export class SchemaResource {
	constructor(private request: <T>(method: string, path: string, body?: unknown) => Promise<T>) {}

	async getOverview(): Promise<ApiResponse<SchemaOverview[]>> {
		return this.request<ApiResponse<SchemaOverview[]>>('GET', '/v1/schema/overview');
	}

	async createTable(input: {
		name: string;
		slug: string;
		workspaceId: string;
		description?: string;
		agentHint?: string;
	}): Promise<ApiResponse<SchemaTable>> {
		return this.request<ApiResponse<SchemaTable>>('POST', '/v1/schema/tables', input);
	}

	async getTable(workspaceId: string, slug: string): Promise<ApiResponse<SchemaTable>> {
		return this.request<ApiResponse<SchemaTable>>(
			'GET',
			`/v1/schema/tables/${workspaceId}/${slug}`,
		);
	}

	async createField(
		tableId: string,
		input: {
			name: string;
			slug: string;
			fieldType: string;
			isRequired?: boolean;
			agentHint?: string;
		},
	): Promise<ApiResponse<SchemaField>> {
		return this.request<ApiResponse<SchemaField>>(
			'POST',
			`/v1/schema/tables/${tableId}/fields`,
			input,
		);
	}
}
