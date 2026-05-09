import type { ApiResponse, Role, User } from '@agentsync/types';

export class MemberResource {
	constructor(private request: <T>(method: string, path: string, body?: unknown) => Promise<T>) {}

	async list(): Promise<ApiResponse<User[]>> {
		return this.request<ApiResponse<User[]>>('GET', '/v1/members');
	}

	async get(id: string): Promise<ApiResponse<User>> {
		return this.request<ApiResponse<User>>('GET', `/v1/members/${id}`);
	}

	async create(input: { email: string; name?: string; roleId?: string }): Promise<
		ApiResponse<User>
	> {
		return this.request<ApiResponse<User>>('POST', '/v1/members', input);
	}

	async update(
		id: string,
		input: { name?: string; roleId?: string; status?: string },
	): Promise<ApiResponse<User>> {
		return this.request<ApiResponse<User>>('PATCH', `/v1/members/${id}`, input);
	}

	async delete(id: string): Promise<ApiResponse<void>> {
		return this.request<ApiResponse<void>>('DELETE', `/v1/members/${id}`);
	}

	async listRoles(): Promise<ApiResponse<Role[]>> {
		return this.request<ApiResponse<Role[]>>('GET', '/v1/members/roles');
	}
}
