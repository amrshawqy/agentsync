import type { RequestContext } from '@agentsync/types';
import type { PermissionService } from './permission.service.js';

/**
 * Admin access is modeled as wildcard CRUD permission.
 * This mirrors the default system admin role created in TeamService.
 */
export async function hasAdminAccess(
	permissionService: PermissionService,
	ctx: RequestContext,
): Promise<boolean> {
	const result = await permissionService.evaluate({
		teamId: ctx.teamId,
		userId: ctx.userId,
		roleId: ctx.roleId,
		workspace: '*',
		table: '*',
		action: 'delete',
	});

	return result.allowed;
}

export async function assertAdminAccess(
	permissionService: PermissionService,
	ctx: RequestContext,
): Promise<void> {
	const allowed = await hasAdminAccess(permissionService, ctx);
	if (!allowed) {
		throw new Error('FORBIDDEN: Admin role required');
	}
}
