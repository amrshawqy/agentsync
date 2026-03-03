import type { ApiResponse, PresignedUploadResult } from '@agentsync/types';

export class UploadResource {
	constructor(private request: <T>(method: string, path: string, body?: unknown) => Promise<T>) {}

	async presign(input: { filename: string; contentType: string; recordId?: string }): Promise<ApiResponse<PresignedUploadResult>> {
		return this.request<ApiResponse<PresignedUploadResult>>('POST', '/v1/uploads/presign', {
			fileName: input.filename,
			mimeType: input.contentType,
			recordId: input.recordId,
		});
	}

	async download(key: string): Promise<ApiResponse<{ downloadUrl: string }>> {
		const path = encodeURIComponent(key);
		return this.request<ApiResponse<{ downloadUrl: string }>>('GET', `/v1/uploads/download?path=${path}`);
	}
}
