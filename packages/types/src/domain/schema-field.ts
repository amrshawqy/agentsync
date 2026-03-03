import { z } from 'zod';
import { FieldType, SourceLayer } from '../enums.js';

export const ValidationSchema = z.object({
	min: z.number().optional(),
	max: z.number().optional(),
	pattern: z.string().optional(),
	unique: z.boolean().optional(),
}).passthrough();

export type Validation = z.infer<typeof ValidationSchema>;

export const ConstraintsSchema = z.object({
	transitions: z.record(z.array(z.string())).optional(),
	cardinality: z.enum(['single', 'multiple']).optional(),
}).passthrough();

export type Constraints = z.infer<typeof ConstraintsSchema>;

export const RelationConfigSchema = z.object({
	targetTableId: z.string().uuid(),
	displayField: z.string().optional(),
	reverseName: z.string().optional(),
});

export type RelationConfig = z.infer<typeof RelationConfigSchema>;

export const RollupConfigSchema = z.object({
	sourceRelation: z.string(),
	sourceField: z.string(),
	aggregation: z.enum(['sum', 'avg', 'min', 'max', 'count', 'concat']),
});

export type RollupConfig = z.infer<typeof RollupConfigSchema>;

export const SchemaFieldSchema = z.object({
	id: z.string().uuid(),
	teamId: z.string().uuid(),
	tableId: z.string().uuid(),
	name: z.string().min(1).max(255),
	slug: z.string().min(1).max(100),
	fieldType: FieldType,
	isRequired: z.boolean().default(false),
	isIndexed: z.boolean().default(false),
	defaultValue: z.unknown().nullable(),
	validation: ValidationSchema.nullable(),
	options: z.array(z.record(z.unknown())).nullable(),
	constraints: ConstraintsSchema.nullable(),
	relationConfig: RelationConfigSchema.nullable(),
	rollupConfig: RollupConfigSchema.nullable(),
	agentHint: z.string().nullable(),
	sourceLayer: SourceLayer,
	fieldOrder: z.number().int().default(0),
	createdAt: z.coerce.date(),
});

export type SchemaField = z.infer<typeof SchemaFieldSchema>;

export const CreateSchemaFieldSchema = z.object({
	name: z.string().min(1).max(255),
	slug: z.string().min(1).max(100),
	fieldType: FieldType,
	isRequired: z.boolean().optional(),
	isIndexed: z.boolean().optional(),
	defaultValue: z.unknown().optional(),
	validation: ValidationSchema.optional(),
	options: z.array(z.record(z.unknown())).optional(),
	constraints: ConstraintsSchema.optional(),
	relationConfig: RelationConfigSchema.optional(),
	rollupConfig: RollupConfigSchema.optional(),
	agentHint: z.string().optional(),
	sourceLayer: SourceLayer.default('workspace'),
	fieldOrder: z.number().int().optional(),
});

export type CreateSchemaField = z.infer<typeof CreateSchemaFieldSchema>;

export const UpdateSchemaFieldSchema = z.object({
	name: z.string().min(1).max(255).optional(),
	isRequired: z.boolean().optional(),
	isIndexed: z.boolean().optional(),
	defaultValue: z.unknown().optional(),
	validation: ValidationSchema.optional(),
	options: z.array(z.record(z.unknown())).optional(),
	constraints: ConstraintsSchema.optional(),
	relationConfig: RelationConfigSchema.optional(),
	rollupConfig: RollupConfigSchema.optional(),
	agentHint: z.string().optional(),
	fieldOrder: z.number().int().optional(),
});

export type UpdateSchemaField = z.infer<typeof UpdateSchemaFieldSchema>;
