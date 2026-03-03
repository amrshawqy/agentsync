import type { ApiResponse, Blueprint, Workspace } from '@agentsync/types';

export class BlueprintResource {
	constructor(private request: <T>(method: string, path: string, body?: unknown) => Promise<T>) {}

	async list(): Promise<ApiResponse<Blueprint[]>> {
		return this.request<ApiResponse<Blueprint[]>>('GET', '/v1/blueprints');
	}

	async listBuiltin(): Promise<ApiResponse<Blueprint[]>> {
		return this.request<ApiResponse<Blueprint[]>>('GET', '/v1/blueprints/builtin');
	}

	async get(slug: string): Promise<ApiResponse<Blueprint>> {
		return this.request<ApiResponse<Blueprint>>('GET', `/v1/blueprints/${slug}`);
	}

	async create(input: { slug: string; name: string; schemaDefinition: Blueprint['schemaDefinition']; description?: string; category?: string }): Promise<ApiResponse<Blueprint>> {
		return this.request<ApiResponse<Blueprint>>('POST', '/v1/blueprints', input);
	}

	async deploy(slug: string, opts?: { workspaceName?: string; workspaceSlug?: string; includeSeedData?: boolean }): Promise<ApiResponse<Workspace>> {
		return this.request<ApiResponse<Workspace>>('POST', `/v1/blueprints/${slug}/deploy`, opts ?? {});
	}

	async evolve(slug: string, changes: Record<string, unknown>): Promise<ApiResponse<Blueprint>> {
		return this.request<ApiResponse<Blueprint>>('POST', `/v1/blueprints/${slug}/evolve`, changes);
	}

	async publish(slug: string): Promise<ApiResponse<Blueprint>> {
		return this.request<ApiResponse<Blueprint>>('POST', `/v1/blueprints/${slug}/publish`);
	}
}
