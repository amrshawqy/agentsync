import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ToolHelpers } from './shared.js';

export function registerSuggestionTools(mcp: McpServer, h: ToolHelpers) {
	const { services, getCtx, resolveTable, requireAdmin, isAdmin } = h;

	mcp.tool(
		'suggest_field',
		'Propose a new field for a table (requires admin approval)',
		{
			table: z.string(),
			workspace: z.string().optional().describe('Workspace slug (optional)'),
			fieldName: z.string(),
			fieldType: z.string(),
			rationale: z.string().describe('Why this field should exist'),
			exampleValue: z.unknown().optional(),
		},
		async (args, extra) => {
			const ctx = getCtx(extra);
			const tableObj = await resolveTable(ctx.teamId, args.table, args.workspace);
			if (!tableObj)
				return {
					content: [{ type: 'text', text: `Table '${args.table}' not found` }],
					isError: true,
				};

			const slug = args.fieldName
				.toLowerCase()
				.replace(/\s+/g, '_')
				.replace(/[^a-z0-9_]/g, '');
			const suggestion = await services.suggestion.suggest(ctx.teamId, ctx.userId, {
				tableId: tableObj.id,
				fieldName: args.fieldName,
				fieldSlug: slug,
				fieldType: args.fieldType as any,
				rationale: args.rationale,
				exampleValue: args.exampleValue,
			});

			return {
				content: [
					{
						type: 'text',
						text: `Field suggestion submitted (ID: ${suggestion.id}). Awaiting admin approval.`,
					},
				],
			};
		},
	);

	mcp.tool('list_suggestions', 'List pending field suggestions', {}, async (_args, extra) => {
		const ctx = getCtx(extra);
		const admin = await isAdmin(ctx);
		const suggestions = admin
			? await services.suggestion.listPending(ctx.teamId)
			: await services.suggestion.listPendingByUser(ctx.teamId, ctx.userId);
		return { content: [{ type: 'text', text: JSON.stringify(suggestions, null, 2) }] };
	});

	mcp.tool(
		'approve_suggestion',
		'Approve a pending field suggestion (creates the field)',
		{
			suggestionId: z.string().uuid(),
			note: z.string().optional(),
		},
		async (args, extra) => {
			const ctx = getCtx(extra);
			const denied = await requireAdmin(ctx);
			if (denied) return denied;

			const result = await services.suggestion.approve(
				args.suggestionId,
				ctx.teamId,
				ctx.userId,
				args.note,
			);
			return {
				content: [
					{
						type: 'text',
						text: `Suggestion approved. Field created: ${JSON.stringify(result, null, 2)}`,
					},
				],
			};
		},
	);

	mcp.tool(
		'reject_suggestion',
		'Reject a pending field suggestion',
		{
			suggestionId: z.string().uuid(),
			note: z.string().optional(),
		},
		async (args, extra) => {
			const ctx = getCtx(extra);
			const denied = await requireAdmin(ctx);
			if (denied) return denied;

			await services.suggestion.reject(args.suggestionId, ctx.teamId, ctx.userId, args.note);
			return { content: [{ type: 'text', text: 'Suggestion rejected.' }] };
		},
	);
}
