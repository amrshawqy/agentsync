import { z } from 'zod';
import { PermissionAction } from '../enums.js';

// 6-layer permission evaluation result
export const PermissionEvaluationSchema = z.object({
	allowed: z.boolean(),
	layer: z.number().int().min(1).max(6).describe('Layer that made the decision'),
	reason: z.string(),
	fieldAccess: z.object({
		hidden: z.array(z.string()),
		readOnly: z.array(z.string()),
	}).optional(),
	recordFilters: z.record(z.record(z.string())).optional(),
});

export type PermissionEvaluation = z.infer<typeof PermissionEvaluationSchema>;

export interface PermissionCheckRequest {
	teamId: string;
	userId: string;
	roleId: string;
	workspace: string;
	table: string;
	action: PermissionAction;
	recordOwnerId?: string;
	recordData?: Record<string, unknown>;
}

export interface PermissionPolicy {
	workspaces: Record<string, {
		tables: Record<string, {
			actions: PermissionAction[];
			field_access?: {
				hidden: string[];
				read_only: string[];
			};
			record_filters?: Record<string, Record<string, string>>;
		}>;
	}>;
}
