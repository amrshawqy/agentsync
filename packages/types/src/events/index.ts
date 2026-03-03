import { z } from 'zod';
import { EventType } from '../enums.js';

export const EventPayloadSchema = z.object({
	eventId: z.string(),
	eventType: EventType,
	timestamp: z.string().datetime(),
	teamId: z.string().uuid(),
	workspace: z.string().optional(),
	table: z.string().optional(),
	workspaceId: z.string().uuid().optional(),
	tableId: z.string().uuid().optional(),
	recordId: z.string().uuid().optional(),
	field: z.string().optional(),
	data: z.record(z.unknown()).default({}),
});

export type EventPayload = z.infer<typeof EventPayloadSchema>;

export const EventPatternSchema = z.object({
	eventType: EventType.optional(),
	workspace: z.string().optional(),
	workspaceId: z.string().uuid().optional(),
	table: z.string().optional(),
	tableId: z.string().uuid().optional(),
	field: z.string().optional(),
	condition: z.record(z.unknown()).optional(),
});

export type EventPattern = z.infer<typeof EventPatternSchema>;

export interface EventHandler {
	subscriptionId: string;
	pattern: EventPattern;
	callback: (event: EventPayload) => void | Promise<void>;
}
