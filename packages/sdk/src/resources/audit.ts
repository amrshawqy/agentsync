import type { PaginatedResponse, AuditLog } from '@agentsync/types';

export class AuditResource {
	constructor(private request: <T>(method: string, path: string, body?: unknown) => Promise<T>) {}

	async query(params?: {
		resourceType?: string;
		resourceId?: string;
		action?: string;
		userId?: string;
		limit?: number;
		offset?: number;
	}): Promise<PaginatedResponse<AuditLog>> {
		const searchParams = new URLSearchParams();
		if (params?.resourceType) searchParams.set('resourceType', params.resourceType);
		if (params?.resourceId) searchParams.set('resourceId', params.resourceId);
		if (params?.action) searchParams.set('action', params.action);
		if (params?.userId) searchParams.set('userId', params.userId);
		if (params?.limit) searchParams.set('limit', String(params.limit));
		if (params?.offset) searchParams.set('offset', String(params.offset));

		const qs = searchParams.toString();
		return this.request<PaginatedResponse<AuditLog>>('GET', `/v1/audit${qs ? `?${qs}` : ''}`);
	}
}
