import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ToolHelpers } from './shared.js';

export function registerUtilityTools(mcp: McpServer, h: ToolHelpers) {
	const { services, getCtx, requireAdmin } = h;

	mcp.tool(
		'get_agent_kit',
		'Generate an Agent Kit for a target platform',
		{
			format: z
				.enum(['claude-desktop', 'claude-code', 'cursor', 'chatgpt', 'raw'])
				.describe('Target platform'),
			memberId: z
				.string()
				.uuid()
				.optional()
				.describe('Generate kit for a specific member (defaults to current user)'),
		},
		async (args, extra) => {
			const ctx = getCtx(extra);
			const targetUserId = args.memberId ?? ctx.userId;
			if (targetUserId !== ctx.userId) {
				const denied = await requireAdmin(ctx);
				if (denied) return denied;
			}
			const result = await services.agentKit.generate(ctx.teamId, targetUserId, args.format);
			return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
		},
	);

	mcp.tool(
		'query_audit_log',
		'Search the audit log',
		{
			resourceType: z.string().optional(),
			resourceId: z.string().optional(),
			action: z.string().optional(),
			limit: z.number().int().default(20),
		},
		async (args, extra) => {
			const ctx = getCtx(extra);
			const denied = await requireAdmin(ctx);
			if (denied) return denied;

			const result = await services.audit.query({
				teamId: ctx.teamId,
				...args,
			});

			return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
		},
	);

	mcp.tool(
		'get_agent_activity',
		'Get recent audit log entries for a specific agent',
		{
			agentId: z.string(),
			limit: z.number().int().min(1).max(100).default(20),
		},
		async (args, extra) => {
			const ctx = getCtx(extra);
			const denied = await requireAdmin(ctx);
			if (denied) return denied;

			const result = await services.audit.query({
				teamId: ctx.teamId,
				userId: args.agentId,
				limit: args.limit,
			});
			return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
		},
	);

	mcp.tool(
		'get_provenance',
		'Get provenance history for a record, optionally for a specific field',
		{
			recordId: z.string().uuid(),
			field: z.string().optional(),
		},
		async (args, extra) => {
			const ctx = getCtx(extra);
			const denied = await requireAdmin(ctx);
			if (denied) return denied;

			const record = await services.data.getRecord(ctx, args.recordId);
			if (!record) return { content: [{ type: 'text', text: 'Record not found' }], isError: true };

			const provenance = record.provenance as Record<string, any>;
			const result = args.field ? { [args.field]: provenance[args.field] } : provenance;
			return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
		},
	);

	mcp.tool(
		'search_marketplace',
		'Search the blueprint marketplace',
		{
			query: z.string().optional().describe('Search query'),
			category: z.string().optional(),
			tags: z.array(z.string()).optional(),
			limit: z.number().int().min(1).max(50).default(20),
			offset: z.number().int().min(0).default(0),
		},
		async (args) => {
			const results = await services.marketplace.searchBlueprints(
				args.query,
				args.category,
				args.tags,
				args.limit,
				args.offset,
			);
			return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
		},
	);

	mcp.tool(
		'submit_blueprint_review',
		'Submit a review for a blueprint',
		{
			blueprintId: z.string().uuid(),
			rating: z.number().int().min(1).max(5),
			title: z.string().max(255).optional(),
			body: z.string().optional(),
		},
		async (args, extra) => {
			const ctx = getCtx(extra);
			const review = await services.marketplace.submitReview(ctx.teamId, ctx.userId, {
				blueprintId: args.blueprintId,
				rating: args.rating,
				title: args.title,
				body: args.body,
			});
			return { content: [{ type: 'text', text: JSON.stringify(review, null, 2) }] };
		},
	);

	mcp.tool(
		'get_context',
		'Get assembled instructions and context for the current agent',
		{},
		async (_args, extra) => {
			const ctx = getCtx(extra);
			const assembled = await services.instruction.assemble(ctx.teamId, ctx.roleId);
			return { content: [{ type: 'text', text: assembled }] };
		},
	);

	mcp.tool(
		'explain_team',
		'Plain-English summary of the current team: blueprints deployed, what tables/fields exist, who is on it, what you (the calling agent) can do.',
		{},
		async (_args, extra) => {
			const ctx = getCtx(extra);
			const team = await services.team.getById(ctx.teamId);
			const overview = await services.schema.getSchemaOverview(ctx.teamId);
			const members = await services.user.listByTeam(ctx.teamId);
			const audit = await services.audit.query({ teamId: ctx.teamId, limit: 5 });
			const role = ctx.roleId ? await services.team.getRoleById(ctx.roleId) : null;

			const tableCount = overview.reduce((acc: number, ws: any) => acc + ws.tables.length, 0);
			const summary = [
				team ? `Team: ${team.name}.` : '',
				`Workspaces: ${overview.length}, tables: ${tableCount}, members: ${members.length}.`,
				role ? `Your role: ${role.name}.` : '',
				audit.data.length > 0
					? `Most recent activity: ${audit.data[0].action} on ${audit.data[0].resourceType}.`
					: '',
			]
				.filter(Boolean)
				.join(' ');

			return {
				content: [{ type: 'text', text: JSON.stringify({ summary, overview }, null, 2) }],
			};
		},
	);
}
