import { z } from 'zod';

export const RecordIndexSchema = z.object({
	recordId: z.string().uuid(),
	teamId: z.string().uuid(),
	tableId: z.string().uuid(),
	fieldId: z.string().uuid(),
	textValue: z.string().nullable(),
	numberValue: z.number().nullable(),
	dateValue: z.coerce.date().nullable(),
	boolValue: z.boolean().nullable(),
});

export type RecordIndex = z.infer<typeof RecordIndexSchema>;
