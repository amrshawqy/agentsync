import type { EventPayload } from '@agentsync/types';
import { logger } from '../../infra/logger.js';
import { type SubscriptionPattern, matchesAnyPattern } from './matcher.js';

interface SSEConnection {
	id: string;
	userId: string;
	teamId: string;
	patterns: SubscriptionPattern[];
	deliverAllWhenNoPatterns: boolean;
	controller: ReadableStreamDefaultController;
}

export class SSEManager {
	private connections = new Map<string, SSEConnection>();

	addConnection(
		id: string,
		userId: string,
		teamId: string,
		patterns: SubscriptionPattern[],
		controller: ReadableStreamDefaultController,
		opts?: { deliverAllWhenNoPatterns?: boolean },
	): void {
		this.connections.set(id, {
			id,
			userId,
			teamId,
			patterns,
			deliverAllWhenNoPatterns: opts?.deliverAllWhenNoPatterns ?? true,
			controller,
		});
		logger.info('SSE connection added', { id, userId });
	}

	removeConnection(id: string): void {
		this.connections.delete(id);
		logger.info('SSE connection removed', { id });
	}

	broadcast(event: EventPayload): void {
		for (const conn of this.connections.values()) {
			if (conn.teamId !== event.teamId) continue;

			const matches = matchesAnyPattern(event, conn.patterns, {
				deliverAllWhenNoPatterns: conn.deliverAllWhenNoPatterns,
			});
			if (!matches) continue;

			try {
				const data = `id: ${event.eventId}\ndata: ${JSON.stringify(event)}\n\n`;
				conn.controller.enqueue(new TextEncoder().encode(data));
			} catch {
				this.removeConnection(conn.id);
			}
		}
	}

	getActiveConnectionCount(): number {
		return this.connections.size;
	}
}
