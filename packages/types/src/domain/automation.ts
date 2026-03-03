import { z } from 'zod';

export const AutomationSchema = z.object({
	id: z.string().uuid(),
	teamId: z.string().uuid(),
	workspaceId: z.string().uuid().nullable(),
	createdBy: z.string().uuid(),
	name: z.string().min(1).max(255),
	trigger: z.record(z.unknown()),
	actions: z.array(z.record(z.unknown())),
	isActive: z.boolean().default(true),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
});

export type Automation = z.infer<typeof AutomationSchema>;

export const CreateAutomationSchema = z.object({
	name: z.string().min(1).max(255),
	workspaceId: z.string().uuid().optional(),
	trigger: z.record(z.unknown()),
	actions: z.array(z.record(z.unknown())),
});

export type CreateAutomation = z.infer<typeof CreateAutomationSchema>;
