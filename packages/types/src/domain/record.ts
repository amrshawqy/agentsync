import { z } from 'zod';

export const ProvenanceEntrySchema = z.object({
	agent: z.string(),
	at: z.string().datetime(),
	confidence: z.number().min(0).max(1),
	verification: z
		.object({
			by: z.string(),
			method: z.string(),
			date: z.string().datetime(),
			outcome: z.enum(['valid', 'invalid', 'unconfirmed']),
		})
		.optional(),
});

export type ProvenanceEntry = z.infer<typeof ProvenanceEntrySchema>;

export const RecordSchema = z.object({
	id: z.string().uuid(),
	teamId: z.string().uuid(),
	tableId: z.string().uuid(),
	data: z.record(z.unknown()).default({}),
	provenance: z.record(ProvenanceEntrySchema).default({}),
	createdBy: z.string().uuid().nullable(),
	updatedBy: z.string().uuid().nullable(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
	deletedAt: z.coerce.date().nullable(),
});

export type Record = z.infer<typeof RecordSchema>;

export const CreateRecordSchema = z.object({
	tableId: z.string().uuid(),
	data: z.record(z.unknown()),
	confidence: z.number().min(0).max(1).optional(),
	links: z
		.array(
			z.object({
				targetRecordId: z.string().uuid(),
				relationType: z.string(),
			}),
		)
		.optional(),
});

export type CreateRecord = z.infer<typeof CreateRecordSchema>;

export const UpdateRecordSchema = z.object({
	data: z.record(z.unknown()),
	confidence: z.number().min(0).max(1).optional(),
});

export type UpdateRecord = z.infer<typeof UpdateRecordSchema>;

export interface RecordWithRelations extends Record {
	relations?: Array<{
		id: string;
		sourceRecordId: string;
		targetRecordId: string;
		relationType: string;
	}>;
}

export const QueryRecordsSchema = z.object({
	tableId: z.string().uuid(),
	filters: z.record(z.unknown()).optional(),
	sort: z
		.array(
			z.object({
				field: z.string(),
				direction: z.enum(['asc', 'desc']).default('asc'),
			}),
		)
		.optional(),
	limit: z.number().int().min(1).max(1000).default(50),
	offset: z.number().int().min(0).default(0),
	search: z.string().optional(),
});

export type QueryRecords = z.infer<typeof QueryRecordsSchema>;
