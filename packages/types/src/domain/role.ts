import { z } from 'zod';
import { PermissionAction } from '../enums.js';

export const FieldAccessSchema = z.object({
	hidden: z.array(z.string()).default([]),
	read_only: z.array(z.string()).default([]),
});

export type FieldAccess = z.infer<typeof FieldAccessSchema>;

export const TablePermissionSchema = z.object({
	actions: z.array(PermissionAction),
	field_access: FieldAccessSchema.optional(),
	record_filters: z.record(z.record(z.string())).optional(),
});

export type TablePermission = z.infer<typeof TablePermissionSchema>;

export const PermissionsSchema = z.record(
	// workspace slug
	z.object({
		tables: z.record(
			// table slug
			TablePermissionSchema,
		),
	}),
);

export type Permissions = z.infer<typeof PermissionsSchema>;

export const RoleSchema = z.object({
	id: z.string().uuid(),
	teamId: z.string().uuid(),
	name: z.string().min(1).max(100),
	isSystem: z.boolean().default(false),
	permissions: PermissionsSchema.default({}),
	createdAt: z.coerce.date(),
});

export type Role = z.infer<typeof RoleSchema>;

export const CreateRoleSchema = z.object({
	name: z.string().min(1).max(100),
	permissions: PermissionsSchema.optional(),
});

export type CreateRole = z.infer<typeof CreateRoleSchema>;

export const UpdateRoleSchema = z.object({
	name: z.string().min(1).max(100).optional(),
	permissions: PermissionsSchema.optional(),
});

export type UpdateRole = z.infer<typeof UpdateRoleSchema>;
