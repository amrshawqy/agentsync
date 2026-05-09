import crypto from 'node:crypto';
import type { Database } from '@agentsync/db';
import { eventSubscriptions } from '@agentsync/db';
import type { CreateEventSubscription, EventPayload } from '@agentsync/types';
import { and, eq } from 'drizzle-orm';
import { getWebhookUrlConfig } from '../../config.js';
import { logger } from '../../infra/logger.js';
import { validateWebhookUrl } from '../../infra/url-validator.js';
import type { EventDispatcher } from './dispatcher.js';
import { type SubscriptionPattern, matchesAnyPattern } from './matcher.js';
import type { SSEManager } from './sse-manager.js';
import type { WebhookSender } from './webhook-sender.js';

export class EventService {
	constructor(
		private db: Database,
		private dispatcher: EventDispatcher,
		private sseManager: SSEManager,
		private webhookSender: WebhookSender,
	) {}

	async subscribe(teamId: string, userId: string, input: CreateEventSubscription) {
		// Early rejection: validate webhook URL before persisting subscription
		if (input.callbackType === 'webhook' && input.callbackUrl) {
			await validateWebhookUrl(input.callbackUrl, getWebhookUrlConfig());
		}

		const [sub] = await this.db
			.insert(eventSubscriptions)
			.values({
				teamId,
				userId,
				eventType: input.eventType,
				workspaceId: input.workspaceId,
				tableId: input.tableId,
				fieldSlug: input.fieldSlug,
				condition: input.condition,
				callbackType: input.callbackType,
				callbackUrl: input.callbackUrl,
			})
			.returning();

		return sub;
	}

	async unsubscribe(subscriptionId: string, teamId: string): Promise<boolean> {
		const result = await this.db
			.update(eventSubscriptions)
			.set({ isActive: false })
			.where(and(eq(eventSubscriptions.id, subscriptionId), eq(eventSubscriptions.teamId, teamId)))
			.returning();

		return result.length > 0;
	}

	async listSubscriptions(teamId: string, userId: string, activeOnly = true) {
		const conditions = [
			eq(eventSubscriptions.teamId, teamId),
			eq(eventSubscriptions.userId, userId),
		];

		if (activeOnly) {
			conditions.push(eq(eventSubscriptions.isActive, true));
		}

		return this.db
			.select()
			.from(eventSubscriptions)
			.where(and(...conditions));
	}

	async replay(
		lastEventId: string,
		teamId: string,
		controller: ReadableStreamDefaultController,
		patterns: SubscriptionPattern[] = [],
		opts?: { deliverAllWhenNoPatterns?: boolean },
	): Promise<void> {
		const batchSize = 500;
		const maxScan = 20000;
		let scanned = 0;
		let cursor = '0-0';
		let found = false;

		while (scanned < maxScan) {
			const entries = await this.dispatcher.readEvents(cursor, batchSize);
			if (entries.length === 0) break;

			for (const entry of entries) {
				scanned++;
				cursor = this.nextStreamId(entry.id);

				if (!found) {
					if (entry.event.eventId === lastEventId) {
						found = true;
					}
					continue;
				}

				if (entry.event.teamId !== teamId) continue;

				const matches = matchesAnyPattern(entry.event, patterns, opts);
				if (!matches) continue;

				try {
					const data = `id: ${entry.event.eventId}\ndata: ${JSON.stringify(entry.event)}\n\n`;
					controller.enqueue(new TextEncoder().encode(data));
				} catch {
					return;
				}
			}
		}
	}

	private nextStreamId(id: string): string {
		const [ms, seq] = id.split('-');
		const seqNum = Number(seq ?? '0');
		return `${ms}-${Number.isFinite(seqNum) ? seqNum + 1 : 1}`;
	}

	async emit(event: Omit<EventPayload, 'eventId' | 'timestamp'>): Promise<void> {
		const fullEvent: EventPayload = {
			...event,
			eventId: `evt-${crypto.randomUUID()}`,
			timestamp: new Date().toISOString(),
		};

		// Dispatch to Redis stream
		await this.dispatcher.dispatch(fullEvent);

		// Push to SSE connections
		this.sseManager.broadcast(fullEvent);

		// Find webhook subscriptions and deliver — match on workspace/table filters
		const conditions = [
			eq(eventSubscriptions.teamId, event.teamId),
			eq(eventSubscriptions.eventType, event.eventType),
			eq(eventSubscriptions.callbackType, 'webhook'),
			eq(eventSubscriptions.isActive, true),
		];

		const webhookSubs = await this.db
			.select()
			.from(eventSubscriptions)
			.where(and(...conditions));

		for (const sub of webhookSubs) {
			// Check workspace filter (null = any workspace)
			if (sub.workspaceId && sub.workspaceId !== event.workspaceId) continue;
			// Check table filter (null = any table)
			if (sub.tableId && sub.tableId !== event.tableId) continue;
			// Check condition match
			if (sub.condition && event.data) {
				const cond = sub.condition as Record<string, unknown>;
				const data = event.data as Record<string, unknown>;
				const conditionMatches = Object.entries(cond).every(([key, value]) => data[key] === value);
				if (!conditionMatches) continue;
			}

			if (sub.callbackUrl) {
				// Fire and forget — don't block the event loop
				this.webhookSender.send(sub.callbackUrl, fullEvent).catch((err) => {
					logger.error('Webhook send failed', { error: String(err) });
				});
			}
		}
	}
}
