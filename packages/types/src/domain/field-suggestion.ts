import { z } from 'zod';
import { FieldType, SuggestionStatus } from '../enums.js';

export const FieldSuggestionSchema = z.object({
	id: z.string().uuid(),
	teamId: z.string().uuid(),
	tableId: z.string().uuid(),
	suggestedBy: z.string().uuid(),
	fieldName: z.string().min(1).max(255),
	fieldSlug: z.string().min(1).max(100),
	fieldType: FieldType,
	agentHint: z.string().nullable(),
	rationale: z.string().min(1),
	exampleValue: z.unknown().nullable(),
	status: SuggestionStatus.default('pending'),
	reviewedBy: z.string().uuid().nullable(),
	reviewNote: z.string().nullable(),
	createdAt: z.coerce.date(),
	reviewedAt: z.coerce.date().nullable(),
});

export type FieldSuggestion = z.infer<typeof FieldSuggestionSchema>;

export const CreateFieldSuggestionSchema = z.object({
	tableId: z.string().uuid(),
	fieldName: z.string().min(1).max(255),
	fieldSlug: z.string().min(1).max(100),
	fieldType: FieldType,
	agentHint: z.string().optional(),
	rationale: z.string().min(1),
	exampleValue: z.unknown().optional(),
});

export type CreateFieldSuggestion = z.infer<typeof CreateFieldSuggestionSchema>;
