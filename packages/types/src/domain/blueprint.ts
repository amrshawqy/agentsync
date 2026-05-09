import { z } from 'zod';

export const BlueprintSchemaDefinitionSchema = z.object({
	tables: z.array(
		z.object({
			slug: z.string(),
			name: z.string(),
			description: z.string().optional(),
			agentHint: z.string().optional(),
			fields: z.array(
				z.object({
					slug: z.string(),
					name: z.string(),
					fieldType: z.string(),
					isRequired: z.boolean().optional(),
					isIndexed: z.boolean().optional(),
					validation: z.record(z.unknown()).optional(),
					options: z.array(z.record(z.unknown())).optional(),
					constraints: z.record(z.unknown()).optional(),
					relationConfig: z.record(z.unknown()).optional(),
					rollupConfig: z.record(z.unknown()).optional(),
					agentHint: z.string().optional(),
				}),
			),
		}),
	),
});

export type BlueprintSchemaDefinition = z.infer<typeof BlueprintSchemaDefinitionSchema>;

export const BlueprintSchema = z.object({
	id: z.string().uuid(),
	slug: z.string().min(1).max(100),
	name: z.string().min(1).max(255),
	description: z.string().nullable(),
	category: z.string().max(100).nullable(),
	version: z.number().int().default(1),
	isBuiltin: z.boolean().default(false),
	createdByTeam: z.string().uuid().nullable(),
	schemaDefinition: BlueprintSchemaDefinitionSchema,
	seedData: z.record(z.array(z.record(z.unknown()))).nullable(),
	instructions: z.record(z.unknown()).nullable(),
	isPublished: z.boolean().default(false),
	marketplaceTags: z.array(z.string()).default([]),
	installCount: z.number().int().default(0),
	avgRating: z.number().nullable(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
});

export type Blueprint = z.infer<typeof BlueprintSchema>;

export const CreateBlueprintSchema = z.object({
	slug: z.string().min(1).max(100),
	name: z.string().min(1).max(255),
	description: z.string().optional(),
	category: z.string().max(100).optional(),
	schemaDefinition: BlueprintSchemaDefinitionSchema,
	seedData: z.record(z.array(z.record(z.unknown()))).optional(),
	instructions: z.record(z.unknown()).optional(),
	marketplaceTags: z.array(z.string()).optional(),
});

export type CreateBlueprint = z.infer<typeof CreateBlueprintSchema>;

export const BlueprintReviewSchema = z.object({
	id: z.string().uuid(),
	blueprintId: z.string().uuid(),
	teamId: z.string().uuid(),
	userId: z.string().uuid(),
	rating: z.number().int().min(1).max(5),
	title: z.string().max(255).nullable(),
	body: z.string().nullable(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
});

export type BlueprintReview = z.infer<typeof BlueprintReviewSchema>;

export const CreateBlueprintReviewSchema = z.object({
	blueprintId: z.string().uuid(),
	rating: z.number().int().min(1).max(5),
	title: z.string().max(255).optional(),
	body: z.string().optional(),
});

export type CreateBlueprintReview = z.infer<typeof CreateBlueprintReviewSchema>;
