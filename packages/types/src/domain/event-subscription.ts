import { z } from 'zod';
import { EventType, CallbackType } from '../enums.js';

export const EventSubscriptionSchema = z.object({
	id: z.string().uuid(),
	teamId: z.string().uuid(),
	userId: z.string().uuid(),
	eventType: EventType,
	workspaceId: z.string().uuid().nullable(),
	tableId: z.string().uuid().nullable(),
	fieldSlug: z.string().max(100).nullable(),
	condition: z.record(z.unknown()).nullable(),
	callbackType: CallbackType,
	callbackUrl: z.string().url().nullable(),
	isActive: z.boolean().default(true),
	createdAt: z.coerce.date(),
});

export type EventSubscription = z.infer<typeof EventSubscriptionSchema>;

export const CreateEventSubscriptionSchema = z.object({
	eventType: EventType,
	workspaceId: z.string().uuid().optional(),
	tableId: z.string().uuid().optional(),
	fieldSlug: z.string().max(100).optional(),
	condition: z.record(z.unknown()).optional(),
	callbackType: CallbackType,
	callbackUrl: z.string().url().optional(),
});

export type CreateEventSubscription = z.infer<typeof CreateEventSubscriptionSchema>;
