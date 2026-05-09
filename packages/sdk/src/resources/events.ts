import type { ApiResponse, EventSubscription } from '@agentsync/types';

export class EventResource {
	constructor(private request: <T>(method: string, path: string, body?: unknown) => Promise<T>) {}

	async subscribe(input: {
		eventType: string;
		callbackType?: string;
		workspaceId?: string;
		tableId?: string;
		fieldSlug?: string;
		condition?: Record<string, unknown>;
		callbackUrl?: string;
	}): Promise<ApiResponse<EventSubscription>> {
		return this.request<ApiResponse<EventSubscription>>('POST', '/v1/events/subscriptions', {
			...input,
			callbackType: input.callbackType ?? 'sse',
		});
	}

	async unsubscribe(subscriptionId: string): Promise<ApiResponse<void>> {
		return this.request<ApiResponse<void>>('DELETE', `/v1/events/subscriptions/${subscriptionId}`);
	}

	async list(activeOnly = true): Promise<ApiResponse<EventSubscription[]>> {
		return this.request<ApiResponse<EventSubscription[]>>(
			'GET',
			`/v1/events/subscriptions?activeOnly=${activeOnly}`,
		);
	}
}
