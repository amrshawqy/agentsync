import { z } from 'zod';
import { TeamPlan } from '../enums.js';

export const TeamSchema = z.object({
	id: z.string().uuid(),
	name: z.string().min(1).max(255),
	slug: z.string().min(1).max(100),
	plan: TeamPlan.default('free'),
	settings: z.record(z.unknown()).default({}),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
});

export type Team = z.infer<typeof TeamSchema>;

export const CreateTeamSchema = TeamSchema.pick({
	name: true,
	slug: true,
}).extend({
	plan: TeamPlan.optional(),
	settings: z.record(z.unknown()).optional(),
});

export type CreateTeam = z.infer<typeof CreateTeamSchema>;

export const UpdateTeamSchema = z.object({
	name: z.string().min(1).max(255).optional(),
	plan: TeamPlan.optional(),
	settings: z.record(z.unknown()).optional(),
});

export type UpdateTeam = z.infer<typeof UpdateTeamSchema>;
