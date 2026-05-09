import postgres from 'postgres';
import { getConfig } from '../config.js';
import { logger } from './logger.js';

export type NotifyHandler = (payload: string) => void;

export class PgNotifyListener {
	private sql: ReturnType<typeof postgres> | null = null;
	private handlers = new Map<string, Set<NotifyHandler>>();

	async connect(): Promise<void> {
		const config = getConfig();
		this.sql = postgres(config.DATABASE_URL);

		// Subscribe to all registered channels
		for (const channel of this.handlers.keys()) {
			await this.sql.listen(channel, (payload) => {
				this.dispatch(channel, payload);
			});
		}

		logger.info('PG NOTIFY listener connected');
	}

	async subscribe(channel: string, handler: NotifyHandler): Promise<void> {
		if (!this.handlers.has(channel)) {
			this.handlers.set(channel, new Set());
			// If already connected, subscribe to new channel
			if (this.sql) {
				await this.sql.listen(channel, (payload) => {
					this.dispatch(channel, payload);
				});
			}
		}
		this.handlers.get(channel)?.add(handler);
	}

	unsubscribe(channel: string, handler: NotifyHandler): void {
		const set = this.handlers.get(channel);
		if (set) {
			set.delete(handler);
			if (set.size === 0) {
				this.handlers.delete(channel);
			}
		}
	}

	private dispatch(channel: string, payload: string): void {
		const set = this.handlers.get(channel);
		if (set) {
			for (const handler of set) {
				try {
					handler(payload);
				} catch (err) {
					logger.error('PG NOTIFY handler error', {
						channel,
						error: String(err),
					});
				}
			}
		}
	}

	async close(): Promise<void> {
		if (this.sql) {
			await this.sql.end();
			this.sql = null;
		}
	}
}
