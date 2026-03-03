import { z } from 'zod';

export const RecordRelationSchema = z.object({
	id: z.string().uuid(),
	teamId: z.string().uuid(),
	sourceRecordId: z.string().uuid(),
	targetRecordId: z.string().uuid(),
	relationType: z.string().min(1).max(100),
	fieldId: z.string().uuid().nullable(),
	createdBy: z.string().uuid().nullable(),
	createdAt: z.coerce.date(),
});

export type RecordRelation = z.infer<typeof RecordRelationSchema>;

export const CreateRecordRelationSchema = z.object({
	sourceRecordId: z.string().uuid(),
	targetRecordId: z.string().uuid(),
	relationType: z.string().min(1).max(100),
	fieldId: z.string().uuid().optional(),
});

export type CreateRecordRelation = z.infer<typeof CreateRecordRelationSchema>;
