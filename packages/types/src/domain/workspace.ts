import { z } from 'zod';

export const WorkspaceSchema = z.object({
	id: z.string().uuid(),
	teamId: z.string().uuid(),
	name: z.string().min(1).max(255),
	slug: z.string().min(1).max(100),
	description: z.string().nullable(),
	blueprintId: z.string().uuid().nullable(),
	blueprintVersion: z.number().int().nullable(),
	createdAt: z.coerce.date(),
});

export type Workspace = z.infer<typeof WorkspaceSchema>;

export const CreateWorkspaceSchema = z.object({
	name: z.string().min(1).max(255),
	slug: z.string().min(1).max(100),
	description: z.string().optional(),
	blueprintId: z.string().uuid().optional(),
});

export type CreateWorkspace = z.infer<typeof CreateWorkspaceSchema>;

export const UpdateWorkspaceSchema = z.object({
	name: z.string().min(1).max(255).optional(),
	description: z.string().optional(),
});

export type UpdateWorkspace = z.infer<typeof UpdateWorkspaceSchema>;
