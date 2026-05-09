import type { ApiResponse, Automation } from '@agentsync/types';

export class AutomationResource {
	constructor(private request: <T>(method: string, path: string, body?: unknown) => Promise<T>) {}

	async list(workspaceId?: string): Promise<ApiResponse<Automation[]>> {
		const qs = workspaceId ? `?workspaceId=${workspaceId}` : '';
		return this.request<ApiResponse<Automation[]>>('GET', `/v1/automations${qs}`);
	}

	async create(input: {
		name: string;
		workspaceId?: string;
		trigger: Record<string, unknown>;
		actions: Record<string, unknown>[];
	}): Promise<ApiResponse<Automation>> {
		return this.request<ApiResponse<Automation>>('POST', '/v1/automations', input);
	}

	async toggle(automationId: string, active: boolean): Promise<ApiResponse<Automation>> {
		return this.request<ApiResponse<Automation>>(
			'PATCH',
			`/v1/automations/${automationId}/toggle`,
			{ active },
		);
	}
}
