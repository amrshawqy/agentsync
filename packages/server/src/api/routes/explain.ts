import type { RequestContext } from '@agentsync/types';
import { Hono } from 'hono';
import {
	explainRolePermissions,
	renderExplanationLines,
} from '../../services/auth/permission-explainer.js';
import type { ServiceContainer } from '../../services/index.js';

function getCtx(c: any): RequestContext {
	return {
		teamId: c.get('teamId'),
		userId: c.get('userId'),
		roleId: c.get('roleId'),
		permissions: {},
	};
}

export function createExplainRoutes(services: ServiceContainer): Hono {
	const app = new Hono();

	app.get('/', async (c) => {
		const ctx = getCtx(c);

		const team = await services.team.getById(ctx.teamId);
		const overview = await services.schema.getSchemaOverview(ctx.teamId);
		const audit = await services.audit.query({ teamId: ctx.teamId, limit: 10 });
		const members = await services.user.listByTeam(ctx.teamId);
		const role = ctx.roleId
			? await services.team.getRoleById?.(ctx.roleId).catch(() => null)
			: null;

		const tableCount = overview.reduce((acc: number, ws: any) => acc + ws.tables.length, 0);
		const fieldCount = overview.reduce(
			(acc: number, ws: any) =>
				acc + ws.tables.reduce((tAcc: number, t: any) => tAcc + (t.fields?.length ?? 0), 0),
			0,
		);

		const explanationLines = role ? explainRolePermissions(role.permissions) : [];

		const recentActivity = audit.data.slice(0, 10).map((a: any) => ({
			at: a.createdAt,
			action: a.action,
			resourceType: a.resourceType,
			resourceId: a.resourceId,
		}));

		const summary = [
			team ? `You are working in team **${team.name}**.` : 'No team in current context.',
			`There ${tableCount === 1 ? 'is' : 'are'} ${tableCount} table${tableCount === 1 ? '' : 's'} across ${overview.length} workspace${overview.length === 1 ? '' : 's'}, with ${fieldCount} field${fieldCount === 1 ? '' : 's'} in total.`,
			members.length === 1
				? 'You are the only member of this team.'
				: `${members.length} people are members of this team.`,
			role
				? `Your role lets you: ${renderExplanationLines(explanationLines)}.`
				: 'Your role permissions are not yet configured.',
		].join(' ');

		return c.json({
			success: true,
			data: {
				summary,
				team,
				stats: {
					workspaces: overview.length,
					tables: tableCount,
					fields: fieldCount,
					members: members.length,
				},
				workspaces: overview.map((ws: any) => ({
					slug: ws.workspace.slug,
					name: ws.workspace.name,
					tables: ws.tables.map((t: any) => ({
						slug: t.slug,
						name: t.name,
						fieldCount: t.fields?.length ?? 0,
					})),
				})),
				role: role ? { id: role.id, name: role.name, permissions: explanationLines } : null,
				recentActivity,
			},
		});
	});

	return app;
}
