import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ToolHelpers } from './shared.js';

export function registerEventTools(mcp: McpServer, h: ToolHelpers) {
	const { services, getCtx, resolveTable } = h;

	mcp.tool(
		'subscribe_events',
		'Subscribe to data change events',
		{
			eventType: z.string().describe('Event type (e.g., record.created)'),
			table: z.string().optional(),
			condition: z.record(z.unknown()).optional(),
		},
		async (args, extra) => {
			const ctx = getCtx(extra);
			let tableId: string | undefined;
			if (args.table) {
				const tableObj = await resolveTable(ctx.teamId, args.table);
				tableId = tableObj?.id;
			}
			const sub = await services.event.subscribe(ctx.teamId, ctx.userId, {
				eventType: args.eventType as any,
				callbackType: 'sse',
				tableId,
				condition: args.condition,
			});

			return { content: [{ type: 'text', text: JSON.stringify(sub, null, 2) }] };
		},
	);

	mcp.tool(
		'unsubscribe_events',
		'Cancel an event subscription',
		{
			subscriptionId: z.string().uuid(),
		},
		async (args, extra) => {
			const ctx = getCtx(extra);
			await services.event.unsubscribe(args.subscriptionId, ctx.teamId);
			return { content: [{ type: 'text', text: 'Unsubscribed.' }] };
		},
	);

	mcp.tool(
		'list_subscriptions',
		'List active event subscriptions',
		{
			activeOnly: z.boolean().default(true),
		},
		async (args, extra) => {
			const ctx = getCtx(extra);
			const subs = await services.event.listSubscriptions(ctx.teamId, ctx.userId, args.activeOnly);
			return { content: [{ type: 'text', text: JSON.stringify(subs, null, 2) }] };
		},
	);
}
