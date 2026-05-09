import type { ApiResponse, Instruction } from '@agentsync/types';

export class InstructionResource {
	constructor(private request: <T>(method: string, path: string, body?: unknown) => Promise<T>) {}

	async getAssembled(): Promise<ApiResponse<string>> {
		return this.request<ApiResponse<string>>('GET', '/v1/instructions/assembled');
	}

	async list(): Promise<ApiResponse<Instruction[]>> {
		return this.request<ApiResponse<Instruction[]>>('GET', '/v1/instructions');
	}

	async create(input: {
		scope: string;
		type: string;
		content: string;
		scopeId?: string;
		priority?: number;
	}): Promise<ApiResponse<Instruction>> {
		return this.request<ApiResponse<Instruction>>('POST', '/v1/instructions', input);
	}

	async update(
		id: string,
		input: { content?: string; priority?: number; isActive?: boolean },
	): Promise<ApiResponse<Instruction>> {
		return this.request<ApiResponse<Instruction>>('PATCH', `/v1/instructions/${id}`, input);
	}

	async delete(id: string): Promise<ApiResponse<void>> {
		return this.request<ApiResponse<void>>('DELETE', `/v1/instructions/${id}`);
	}
}
