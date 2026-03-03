import type { ApiResponse, PaginatedResponse, Record, RecordWithRelations, RecordRelation } from '@agentsync/types';

export class PaginatedResult<T> {
	readonly data: T[];
	readonly total: number;
	readonly hasMore: boolean;

	private readonly _limit: number;
	private readonly _offset: number;
	private readonly _fetchNext: (offset: number, limit: number) => Promise<PaginatedResponse<T>>;

	constructor(response: PaginatedResponse<T>, fetchNext: (offset: number, limit: number) => Promise<PaginatedResponse<T>>) {
		this.data = response.data;
		this.total = response.total;
		this.hasMore = response.hasMore;
		this._limit = response.limit;
		this._offset = response.offset;
		this._fetchNext = fetchNext;
	}

	async nextPage(): Promise<PaginatedResult<T>> {
		if (!this.hasMore) {
			throw new Error('No more pages available');
		}
		const nextOffset = this._offset + this._limit;
		const response = await this._fetchNext(nextOffset, this._limit);
		return new PaginatedResult<T>(response, this._fetchNext);
	}
}

export class RecordResource {
	constructor(private request: <T>(method: string, path: string, body?: unknown) => Promise<T>) {}

	async create(tableId: string, data: globalThis.Record<string, unknown>, links?: Array<{ targetRecordId: string; relationType: string }>): Promise<ApiResponse<Record>> {
		return this.request<ApiResponse<Record>>('POST', '/v1/records', { tableId, data, links });
	}

	async get(recordId: string): Promise<ApiResponse<RecordWithRelations>> {
		return this.request<ApiResponse<RecordWithRelations>>('GET', `/v1/records/${recordId}`);
	}

	async update(recordId: string, data: globalThis.Record<string, unknown>): Promise<ApiResponse<Record>> {
		return this.request<ApiResponse<Record>>('PATCH', `/v1/records/${recordId}`, { data });
	}

	async delete(recordId: string, reason?: string): Promise<ApiResponse<void>> {
		return this.request<ApiResponse<void>>('DELETE', `/v1/records/${recordId}`, { reason });
	}

	async query(params: {
		tableId: string;
		filters?: globalThis.Record<string, unknown>;
		limit?: number;
		offset?: number;
		search?: string;
	}): Promise<PaginatedResponse<Record>> {
		const searchParams = new URLSearchParams({ tableId: params.tableId });
		if (params.filters) searchParams.set('filters', JSON.stringify(params.filters));
		if (params.limit) searchParams.set('limit', String(params.limit));
		if (params.offset) searchParams.set('offset', String(params.offset));
		if (params.search) searchParams.set('search', params.search);

		return this.request<PaginatedResponse<Record>>('GET', `/v1/records?${searchParams}`);
	}

	async verify(recordId: string, field: string, method: string, outcome: 'valid' | 'invalid' | 'unconfirmed'): Promise<ApiResponse<Record>> {
		return this.request<ApiResponse<Record>>('POST', `/v1/records/${recordId}/verify`, { field, method, outcome });
	}

	async link(sourceId: string, targetId: string, relationType: string): Promise<ApiResponse<RecordRelation>> {
		return this.request<ApiResponse<RecordRelation>>('POST', `/v1/records/${sourceId}/links`, { targetRecordId: targetId, relationType });
	}

	async unlink(sourceId: string, targetId: string, relationType: string): Promise<ApiResponse<void>> {
		return this.request<ApiResponse<void>>('DELETE', `/v1/records/${sourceId}/links/${targetId}/${relationType}`);
	}

	async traverse(recordId: string, path: string, depth?: number): Promise<ApiResponse<Record[]>> {
		const params = new URLSearchParams({ path });
		if (depth) params.set('depth', String(depth));
		return this.request<ApiResponse<Record[]>>('GET', `/v1/records/${recordId}/traverse?${params}`);
	}

	async getProvenance(recordId: string, field?: string): Promise<ApiResponse<globalThis.Record<string, unknown>>> {
		const params = field ? `?field=${field}` : '';
		return this.request<ApiResponse<globalThis.Record<string, unknown>>>('GET', `/v1/records/${recordId}/provenance${params}`);
	}

	async queryPaginated(params: {
		tableId: string;
		filters?: globalThis.Record<string, unknown>;
		limit?: number;
		offset?: number;
		search?: string;
	}): Promise<PaginatedResult<Record>> {
		const response = await this.query(params);
		const fetchNext = (offset: number, limit: number) =>
			this.query({ ...params, offset, limit });
		return new PaginatedResult(response, fetchNext);
	}

	async *queryAll(params: {
		tableId: string;
		filters?: globalThis.Record<string, unknown>;
		limit?: number;
		search?: string;
	}): AsyncGenerator<Record[], void, undefined> {
		let offset = 0;
		const limit = params.limit ?? 100;
		let hasMore = true;

		while (hasMore) {
			const response = await this.query({ ...params, offset, limit });
			yield response.data;
			hasMore = response.hasMore;
			offset += limit;
		}
	}

	async bulkImport(tableId: string, records: globalThis.Record<string, unknown>[]): Promise<ApiResponse<Record[]>> {
		return this.request<ApiResponse<Record[]>>('POST', '/v1/records/bulk', { tableId, records });
	}
}
