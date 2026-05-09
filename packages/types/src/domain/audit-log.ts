import { z } from 'zod';
import { AuditAction, ResourceType } from '../enums.js';

export const AuditLogSchema = z.object({
	id: z.string().uuid(),
	teamId: z.string().uuid(),
	userId: z.string().uuid().nullable(),
	agentId: z.string().nullable(),
	action: AuditAction,
	resourceType: ResourceType.nullable(),
	resourceId: z.string().uuid().nullable(),
	tableId: z.string().uuid().nullable(),
	reason: z.string().nullable(),
	changes: z
		.record(
			z.object({
				old: z.unknown(),
				new: z.unknown(),
			}),
		)
		.nullable(),
	provenance: z.record(z.unknown()).nullable(),
	metadata: z.record(z.unknown()).nullable(),
	createdAt: z.coerce.date(),
});

export type AuditLog = z.infer<typeof AuditLogSchema>;

export const CreateAuditLogSchema = z.object({
	action: AuditAction,
	resourceType: ResourceType.optional(),
	resourceId: z.string().uuid().optional(),
	tableId: z.string().uuid().optional(),
	reason: z.string().optional(),
	changes: z
		.record(
			z.object({
				old: z.unknown(),
				new: z.unknown(),
			}),
		)
		.optional(),
	provenance: z.record(z.unknown()).optional(),
	metadata: z.record(z.unknown()).optional(),
});

export type CreateAuditLog = z.infer<typeof CreateAuditLogSchema>;
