import type Redis from 'ioredis';
import type { EventPayload } from '@agentsync/types';
import { logger } from '../../infra/logger.js';

const STREAM_KEY = 'agentsync:events';
const MAX_STREAM_LEN = 10000;

export class EventDispatcher {
	constructor(private redis: Redis) {}

	async dispatch(event: EventPayload): Promise<string> {
		const id = await this.redis.xadd(
			STREAM_KEY,
			'MAXLEN',
			'~',
			MAX_STREAM_LEN,
			'*',
			'payload',
			JSON.stringify(event),
		);

		logger.debug('Event dispatched', {
			eventId: event.eventId,
			eventType: event.eventType,
			streamId: id,
		});

		return id ?? '';
	}

	async readEvents(
		lastId: string = '0',
		count: number = 100,
	): Promise<Array<{ id: string; event: EventPayload }>> {
		const results = await this.redis.xrange(STREAM_KEY, lastId, '+', 'COUNT', count);

		return results.map(([id, fields]) => {
			const payloadIndex = fields.indexOf('payload');
			const payload = payloadIndex >= 0 ? fields[payloadIndex + 1] : '{}';
			return {
				id,
				event: JSON.parse(payload) as EventPayload,
			};
		});
	}

	async readNewEvents(
		consumerGroup: string,
		consumer: string,
		count: number = 10,
	): Promise<Array<{ id: string; event: EventPayload }>> {
		try {
			await this.redis.xgroup('CREATE', STREAM_KEY, consumerGroup, '$', 'MKSTREAM');
		} catch {
			// Group already exists
		}

		const results = await this.redis.xreadgroup(
			'GROUP',
			consumerGroup,
			consumer,
			'COUNT',
			count,
			'BLOCK',
			1000,
			'STREAMS',
			STREAM_KEY,
			'>',
		);

		if (!results) return [];

		const entries: Array<{ id: string; event: EventPayload }> = [];
		for (const [, messages] of results as [string, [string, string[]][]][]) {
			for (const [id, fields] of messages) {
				const payloadIndex = fields.indexOf('payload');
				const payload = payloadIndex >= 0 ? fields[payloadIndex + 1] : '{}';
				entries.push({
					id,
					event: JSON.parse(payload) as EventPayload,
				});
			}
		}

		return entries;
	}

	async acknowledge(consumerGroup: string, id: string): Promise<void> {
		await this.redis.xack(STREAM_KEY, consumerGroup, id);
	}
}
