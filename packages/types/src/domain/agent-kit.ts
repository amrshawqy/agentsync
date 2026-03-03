import { z } from 'zod';
import { AgentKitFormat, AgentKitComponent } from '../enums.js';

export const AgentKitTemplateSchema = z.object({
	id: z.string().uuid(),
	teamId: z.string().uuid().nullable(),
	format: AgentKitFormat,
	component: AgentKitComponent,
	template: z.string(),
	isActive: z.boolean().default(true),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
});

export type AgentKitTemplate = z.infer<typeof AgentKitTemplateSchema>;

export const AgentKitGenerationSchema = z.object({
	id: z.string().uuid(),
	teamId: z.string().uuid(),
	userId: z.string().uuid(),
	format: AgentKitFormat,
	schemaVersionHash: z.string().max(64),
	generatedAt: z.coerce.date(),
});

export type AgentKitGeneration = z.infer<typeof AgentKitGenerationSchema>;

export const GenerateAgentKitSchema = z.object({
	format: AgentKitFormat,
	userId: z.string().uuid().optional(),
});

export type GenerateAgentKit = z.infer<typeof GenerateAgentKitSchema>;
