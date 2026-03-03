import type { ApiResponse, Workspace } from '@agentsync/types';

export class WorkspaceResource {
	constructor(private request: <T>(method: string, path: string, body?: unknown) => Promise<T>) {}

	async list(): Promise<ApiResponse<Workspace[]>> {
		return this.request<ApiResponse<Workspace[]>>('GET', '/v1/workspaces');
	}
}
