import { eq } from 'drizzle-orm';
import type { Database } from '@agentsync/db';
import { roles, users } from '@agentsync/db';
import type { PermissionAction } from '@agentsync/types';
import type { PermissionEvaluation } from '@agentsync/types';
import type { CacheService } from '../cache/cache.service.js';

export class PermissionService {
	constructor(
		private db: Database,
		private cache: CacheService,
	) {}

	async evaluate(params: {
		teamId: string;
		userId: string;
		roleId: string;
		workspace: string;
		table: string;
		action: PermissionAction;
		recordOwnerId?: string;
		recordData?: Record<string, unknown>;
	}): Promise<PermissionEvaluation> {
		// Layer 1: Team access — is the user active in this team?
		const cacheKey = `perm:${params.teamId}:${params.roleId}:${params.workspace}:${params.table}:${params.action}`;
		const cached = await this.cache.get<PermissionEvaluation>(cacheKey);
		if (cached && !params.recordOwnerId) return cached;

		const [user] = await this.db
			.select()
			.from(users)
			.where(eq(users.id, params.userId));

		if (!user || user.status !== 'active' || user.teamId !== params.teamId) {
			return { allowed: false, layer: 1, reason: 'User not active in team' };
		}

		// Get role permissions
		const [role] = await this.db
			.select()
			.from(roles)
			.where(eq(roles.id, params.roleId));

		if (!role) {
			return { allowed: false, layer: 1, reason: 'Role not found' };
		}

		const permissions = role.permissions as Record<string, any>;

		// Admin shortcut — wildcard permissions
		if (permissions['*']) {
			const wildcard = permissions['*'];
			if (wildcard.tables?.['*']?.actions?.includes(params.action)) {
				const result: PermissionEvaluation = { allowed: true, layer: 2, reason: 'Admin wildcard' };
				await this.cache.set(cacheKey, result, 300);
				return result;
			}
		}

		// Layer 2: Workspace access
		const workspacePerms = permissions[params.workspace];
		if (!workspacePerms) {
			return { allowed: false, layer: 2, reason: `No access to workspace: ${params.workspace}` };
		}

		// Layer 3: Table access
		const tablePerms = workspacePerms.tables?.[params.table] ?? workspacePerms.tables?.['*'];
		if (!tablePerms) {
			return { allowed: false, layer: 3, reason: `No access to table: ${params.table}` };
		}

		if (!tablePerms.actions?.includes(params.action)) {
			return {
				allowed: false,
				layer: 3,
				reason: `Action '${params.action}' not allowed on ${params.table}`,
			};
		}

		// Layer 4: Field access
		const fieldAccess = tablePerms.field_access
			? {
					hidden: tablePerms.field_access.hidden ?? [],
					readOnly: tablePerms.field_access.read_only ?? [],
				}
			: undefined;

		// Layer 5: Record filters
		const recordFilters = tablePerms.record_filters;
		if (recordFilters && (params.action === 'update' || params.action === 'delete')) {
			const filterFailure = this.evaluateRecordFilters(recordFilters, params);
			if (filterFailure) {
				return filterFailure;
			}
		}

		// Layer 6 is handled by ConstraintService (state machine, validation)

		const result: PermissionEvaluation = {
			allowed: true,
			layer: 6,
			reason: 'Permitted',
			fieldAccess,
			recordFilters,
		};

		// Cache (only if no record-specific check was needed)
		if (!params.recordOwnerId) {
			await this.cache.set(cacheKey, result, 300);
		}

		return result;
	}

	private evaluateRecordFilters(
		recordFilters: Record<string, Record<string, string>>,
		params: {
			userId: string;
			teamId: string;
			roleId: string;
			recordOwnerId?: string;
			recordData?: Record<string, unknown>;
		},
	): PermissionEvaluation | null {
		const writeFilter = recordFilters.write;
		if (!writeFilter) return null;

		const variableMap: Record<string, string> = {
			'$current_user': params.userId,
			'$current_team': params.teamId,
			'$current_role': params.roleId,
		};

		for (const [field, expectedValue] of Object.entries(writeFilter)) {
			const resolved = variableMap[expectedValue] ?? expectedValue;

			// Check against recordOwnerId for backward compat with created_by
			if (field === 'created_by' && params.recordOwnerId) {
				if (params.recordOwnerId !== resolved) {
					return {
						allowed: false,
						layer: 5,
						reason: 'Can only modify own records',
					};
				}
				continue;
			}

			// Check against recordData for other filter fields
			if (params.recordData) {
				const actual = params.recordData[field];
				if (actual !== undefined && String(actual) !== resolved) {
					return {
						allowed: false,
						layer: 5,
						reason: `Record filter denied: ${field} does not match ${expectedValue}`,
					};
				}
			}
		}

		return null;
	}

	async invalidateTeamPermissions(teamId: string): Promise<void> {
		await this.cache.delPattern(`perm:${teamId}:*`);
	}
}
