import { z } from 'zod';
import { InstructionScope, InstructionType } from '../enums.js';

export const InstructionSchema = z.object({
	id: z.string().uuid(),
	teamId: z.string().uuid(),
	scope: InstructionScope,
	scopeId: z.string().uuid().nullable(),
	instructionType: InstructionType.nullable(),
	content: z.string().min(1),
	priority: z.number().int().default(0),
	isActive: z.boolean().default(true),
	version: z.number().int().default(1),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
});

export type Instruction = z.infer<typeof InstructionSchema>;

export const CreateInstructionSchema = z.object({
	scope: InstructionScope,
	scopeId: z.string().uuid().optional(),
	instructionType: InstructionType.optional(),
	content: z.string().min(1),
	priority: z.number().int().optional(),
});

export type CreateInstruction = z.infer<typeof CreateInstructionSchema>;

export const UpdateInstructionSchema = z.object({
	content: z.string().min(1).optional(),
	priority: z.number().int().optional(),
	isActive: z.boolean().optional(),
});

export type UpdateInstruction = z.infer<typeof UpdateInstructionSchema>;
