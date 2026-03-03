import { z } from 'zod';
import { SourceLayer } from '../enums.js';

export const SchemaTableSchema = z.object({
	id: z.string().uuid(),
	teamId: z.string().uuid(),
	workspaceId: z.string().uuid(),
	name: z.string().min(1).max(255),
	slug: z.string().min(1).max(100),
	description: z.string().nullable(),
	agentHint: z.string().nullable(),
	sourceLayer: SourceLayer,
	blueprintId: z.string().uuid().nullable(),
	settings: z.record(z.unknown()).default({}),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
});

export type SchemaTable = z.infer<typeof SchemaTableSchema>;

export const CreateSchemaTableSchema = z.object({
	name: z.string().min(1).max(255),
	slug: z.string().min(1).max(100),
	workspaceId: z.string().uuid(),
	description: z.string().optional(),
	agentHint: z.string().optional(),
	sourceLayer: SourceLayer.default('workspace'),
});

export type CreateSchemaTable = z.infer<typeof CreateSchemaTableSchema>;

export const UpdateSchemaTableSchema = z.object({
	name: z.string().min(1).max(255).optional(),
	description: z.string().optional(),
	agentHint: z.string().optional(),
	settings: z.record(z.unknown()).optional(),
});

export type UpdateSchemaTable = z.infer<typeof UpdateSchemaTableSchema>;
