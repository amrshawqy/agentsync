import { z } from 'zod';
import { UserStatus } from '../enums.js';

export const UserSchema = z.object({
	id: z.string().uuid(),
	accountId: z.string().uuid().nullable().optional(),
	teamId: z.string().uuid(),
	email: z.string().email().max(255),
	name: z.string().max(255).nullable(),
	roleId: z.string().uuid().nullable(),
	agentId: z.string().max(255).nullable(),
	status: UserStatus.default('invited'),
	lastConnectedAt: z.coerce.date().nullable(),
	createdAt: z.coerce.date(),
});

export type User = z.infer<typeof UserSchema>;

export const CreateUserSchema = z.object({
	accountId: z.string().uuid().optional(),
	email: z.string().email().max(255),
	name: z.string().max(255).optional(),
	roleId: z.string().uuid().optional(),
	agentId: z.string().max(255).optional(),
});

export type CreateUser = z.infer<typeof CreateUserSchema>;

export const UpdateUserSchema = z.object({
	name: z.string().max(255).optional(),
	roleId: z.string().uuid().optional(),
	agentId: z.string().max(255).optional(),
	status: UserStatus.optional(),
});

export type UpdateUser = z.infer<typeof UpdateUserSchema>;
