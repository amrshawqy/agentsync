import type { EventPayload, EventPattern } from '@agentsync/types';

export interface SubscriptionPattern extends EventPattern {
	workspaceId?: string;
	tableId?: string;
	fieldSlug?: string;
}

export function matchesPattern(
	event: EventPayload,
	pattern: SubscriptionPattern,
): boolean {
	if (pattern.eventType && pattern.eventType !== event.eventType) return false;
	if (pattern.workspace && pattern.workspace !== event.workspace) return false;
	if (pattern.workspaceId && pattern.workspaceId !== event.workspaceId) return false;
	if (pattern.table && pattern.table !== event.table) return false;
	if (pattern.tableId && pattern.tableId !== event.tableId) return false;
	if (pattern.field && pattern.field !== event.field) return false;
	if (pattern.fieldSlug && pattern.fieldSlug !== event.field) return false;

	if (pattern.condition) {
		for (const [key, value] of Object.entries(pattern.condition)) {
			if (event.data[key] !== value) return false;
		}
	}

	return true;
}

export function matchesAnyPattern(
	event: EventPayload,
	patterns: SubscriptionPattern[],
	opts?: { deliverAllWhenNoPatterns?: boolean },
): boolean {
	const deliverAllWhenNoPatterns = opts?.deliverAllWhenNoPatterns ?? true;
	if (patterns.length === 0) return deliverAllWhenNoPatterns;
	return patterns.some((pattern) => matchesPattern(event, pattern));
}
