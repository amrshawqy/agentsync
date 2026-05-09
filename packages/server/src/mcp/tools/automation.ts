import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ToolHelpers } from './shared.js';

export function registerAutomationTools(mcp: McpServer, h: ToolHelpers) {
	const { services, getCtx, requireAdmin } = h;

	mcp.tool(
		'create_automation',
		'Create a new automation rule',
		{
			name: z.string(),
			workspace: z.string().optional(),
			trigger: z.record(z.unknown()),
			actions: z.array(z.record(z.unknown())),
		},
		async (args, extra) => {
			const ctx = getCtx(extra);
			const denied = await requireAdmin(ctx);
			if (denied) return denied;

			let workspaceId: string | undefined;
			if (args.workspace) {
				const ws = await services.schema.getWorkspaceBySlug(ctx.teamId, args.workspace);
				workspaceId = ws?.id;
			}
			const automation = await services.automation.create(ctx.teamId, ctx.userId, {
				name: args.name,
				workspaceId,
				trigger: args.trigger,
				actions: args.actions,
			});
			return { content: [{ type: 'text', text: JSON.stringify(automation, null, 2) }] };
		},
	);

	mcp.tool(
		'list_automations',
		'List automations, optionally filtered by workspace',
		{
			workspace: z.string().optional(),
		},
		async (args, extra) => {
			const ctx = getCtx(extra);
			const denied = await requireAdmin(ctx);
			if (denied) return denied;

			let workspaceId: string | undefined;
			if (args.workspace) {
				const ws = await services.schema.getWorkspaceBySlug(ctx.teamId, args.workspace);
				workspaceId = ws?.id;
			}
			const automations = await services.automation.list(ctx.teamId, workspaceId);
			return { content: [{ type: 'text', text: JSON.stringify(automations, null, 2) }] };
		},
	);

	mcp.tool(
		'toggle_automation',
		'Enable or disable an automation',
		{
			automationId: z.string().uuid(),
			active: z.boolean(),
		},
		async (args, extra) => {
			const ctx = getCtx(extra);
			const denied = await requireAdmin(ctx);
			if (denied) return denied;

			const updated = await services.automation.toggle(args.automationId, ctx.teamId, args.active);
			return {
				content: [
					{
						type: 'text',
						text: `Automation ${args.active ? 'enabled' : 'disabled'}: ${updated.name}`,
					},
				],
			};
		},
	);
}
