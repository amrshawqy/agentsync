import type { RequestContext } from '@agentsync/types';
import { hasAdminAccess } from '../../services/auth/admin-access.js';
import type { ServiceContainer } from '../../services/index.js';

export type AuthContextGetter = () => RequestContext;

export const TEAM_SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const RESERVED_SLUGS = new Set(['admin', 'api', 'support', 'www', 'status', 'help', 'root']);

export type ToolErrorResult = {
	content: { type: 'text'; text: string }[];
	isError: true;
};

export interface ToolHelpers {
	services: ServiceContainer;
	getCtx: (extra?: Record<string, unknown>) => RequestContext;
	resolveAccountId: (ctx: RequestContext) => Promise<string | null>;
	resolveTable: (
		teamId: string,
		tableSlug: string,
		workspaceSlug?: string,
	) => Promise<{ id: string; slug: string; name: string } | null>;
	forbiddenResult: (message?: string) => ToolErrorResult;
	requireAdmin: (ctx: RequestContext) => Promise<ToolErrorResult | null>;
	isAdmin: (ctx: RequestContext) => Promise<boolean>;
}

export function createHelpers(
	services: ServiceContainer,
	getAuthContext?: AuthContextGetter,
): ToolHelpers {
	function getCtx(extra?: Record<string, unknown>): RequestContext {
		if (getAuthContext) {
			return getAuthContext();
		}
		return {
			teamId: (extra?.teamId as string) ?? '',
			userId: (extra?.userId as string) ?? '',
			roleId: (extra?.roleId as string) ?? '',
			accountId: (extra?.accountId as string) ?? undefined,
			agentId: (extra?.agentId as string) ?? undefined,
			limitsTier: (extra?.limitsTier as 'unverified' | 'verified') ?? undefined,
			permissions: {},
		};
	}

	async function resolveAccountId(ctx: RequestContext): Promise<string | null> {
		if (ctx.accountId) return ctx.accountId as string;
		if (!ctx.userId) return null;
		return services.account.ensureAccountForMembership(ctx.userId);
	}

	async function resolveTable(teamId: string, tableSlug: string, workspaceSlug?: string) {
		if (workspaceSlug) {
			const ws = await services.schema.getWorkspaceBySlug(teamId, workspaceSlug);
			if (!ws) return null;
			return services.schema.getTableBySlug(teamId, ws.id, tableSlug);
		}
		return services.schema.findTableBySlug(teamId, tableSlug);
	}

	function forbiddenResult(message = 'FORBIDDEN: Admin role required'): ToolErrorResult {
		return { content: [{ type: 'text', text: message }], isError: true };
	}

	async function isAdmin(ctx: RequestContext): Promise<boolean> {
		return hasAdminAccess(services.permission, ctx);
	}

	async function requireAdmin(ctx: RequestContext): Promise<ToolErrorResult | null> {
		const allowed = await isAdmin(ctx);
		return allowed ? null : forbiddenResult();
	}

	return {
		services,
		getCtx,
		resolveAccountId,
		resolveTable,
		forbiddenResult,
		requireAdmin,
		isAdmin,
	};
}
