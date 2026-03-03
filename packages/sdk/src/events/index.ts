export interface SSEEvent {
	eventId: string;
	eventType: string;
	data: Record<string, unknown>;
}

export type SSEHandler = (event: SSEEvent) => void;

/**
 * SSE consumer that uses fetch to read a text/event-stream.
 * Works in both Node.js 20+ and browsers.
 */
export class SSEConsumer {
	private controller: AbortController | null = null;
	private handlers = new Map<string, Set<SSEHandler>>();
	private reconnectAttempts = 0;
	private maxReconnectAttempts = 10;
	private reconnectDelay = 1000;
	private lastEventId: string | null = null;

	constructor(
		private url: string,
		private getToken: () => Promise<string>,
	) {}

	async connect(): Promise<void> {
		const token = await this.getToken();

		this.controller = new AbortController();
		const headers: Record<string, string> = {
			Accept: 'text/event-stream',
			Authorization: `Bearer ${token}`,
		};
		if (this.lastEventId) {
			headers['Last-Event-ID'] = this.lastEventId;
		}

		try {
			const response = await fetch(this.url, {
				headers,
				signal: this.controller.signal,
			});

			if (!response.ok || !response.body) {
				this.scheduleReconnect();
				return;
			}

			this.reconnectAttempts = 0;

			const reader = response.body.getReader();
			const decoder = new TextDecoder();
			let buffer = '';

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				buffer += decoder.decode(value, { stream: true });
				const lines = buffer.split('\n\n');
				buffer = lines.pop() ?? '';

				for (const block of lines) {
					const idLine = block
						.split('\n')
						.find((l) => l.startsWith('id: '));
					const dataLine = block
						.split('\n')
						.find((l) => l.startsWith('data: '));

					if (idLine) {
						const id = idLine.slice(4).trim();
						if (id && id !== 'connect') {
							this.lastEventId = id;
						}
					}

					if (dataLine) {
						try {
							const parsed = JSON.parse(dataLine.slice(6)) as SSEEvent;
							if (!this.lastEventId && parsed.eventId) {
								this.lastEventId = parsed.eventId;
							}
							this.dispatch(parsed);
						} catch {
							// Ignore parse errors
						}
					}
				}
			}

			// Stream ended unexpectedly — try reconnect unless explicitly aborted.
			if (!this.controller.signal.aborted) {
				this.scheduleReconnect();
			}
		} catch (err) {
			if ((err as Error).name !== 'AbortError') {
				this.scheduleReconnect();
			}
		}
	}

	on(eventType: string, handler: SSEHandler): () => void {
		if (!this.handlers.has(eventType)) {
			this.handlers.set(eventType, new Set());
		}
		this.handlers.get(eventType)!.add(handler);

		return () => {
			this.handlers.get(eventType)?.delete(handler);
		};
	}

	onAll(handler: SSEHandler): () => void {
		return this.on('*', handler);
	}

	private dispatch(event: SSEEvent): void {
		const typeHandlers = this.handlers.get(event.eventType);
		if (typeHandlers) {
			for (const handler of typeHandlers) {
				handler(event);
			}
		}

		const wildcardHandlers = this.handlers.get('*');
		if (wildcardHandlers) {
			for (const handler of wildcardHandlers) {
				handler(event);
			}
		}
	}

	private scheduleReconnect(): void {
		if (this.reconnectAttempts >= this.maxReconnectAttempts) return;

		const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
		this.reconnectAttempts++;

		setTimeout(() => this.connect(), delay);
	}

	disconnect(): void {
		this.controller?.abort();
		this.controller = null;
		this.reconnectAttempts = this.maxReconnectAttempts;
	}
}
