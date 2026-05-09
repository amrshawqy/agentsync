import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ToolHelpers } from './shared.js';

export function registerSchemaTools(mcp: McpServer, h: ToolHelpers) {
	const { services, getCtx, resolveTable, requireAdmin } = h;

	mcp.tool(
		'describe_table',
		'Get full schema details for a table',
		{
			table: z.string().describe('Table slug'),
			workspace: z.string().optional().describe('Workspace slug (optional)'),
		},
		async (args, extra) => {
			const ctx = getCtx(extra);
			const tableObj = await resolveTable(ctx.teamId, args.table, args.workspace);
			if (!tableObj)
				return {
					content: [{ type: 'text', text: `Table '${args.table}' not found` }],
					isError: true,
				};

			const fields = await services.schema.getFieldsForTable(tableObj.id);
			return {
				content: [{ type: 'text', text: JSON.stringify({ ...tableObj, fields }, null, 2) }],
			};
		},
	);

	mcp.tool(
		'create_workspace',
		'Create a new workspace',
		{
			name: z.string(),
			slug: z.string(),
			blueprintId: z.string().uuid().optional(),
		},
		async (args, extra) => {
			const ctx = getCtx(extra);
			const denied = await requireAdmin(ctx);
			if (denied) return denied;

			if (args.blueprintId) {
				const bp = await services.blueprint.getById(args.blueprintId);
				if (!bp) return { content: [{ type: 'text', text: 'Blueprint not found' }], isError: true };
				const ws = await services.blueprint.deploy(ctx.teamId, bp.slug, {
					workspaceName: args.name,
					workspaceSlug: args.slug,
				});
				return { content: [{ type: 'text', text: JSON.stringify(ws, null, 2) }] };
			}
			const ws = await services.schema.createWorkspace(ctx.teamId, args.name, args.slug);
			return { content: [{ type: 'text', text: JSON.stringify(ws, null, 2) }] };
		},
	);

	mcp.tool(
		'create_table',
		'Create a new table in a workspace',
		{
			workspace: z.string().describe('Workspace slug'),
			name: z.string(),
			slug: z.string(),
			description: z.string().optional(),
			agentHint: z.string().optional(),
			fields: z
				.array(
					z.object({
						name: z.string(),
						slug: z.string(),
						fieldType: z.string(),
						isRequired: z.boolean().optional(),
						isIndexed: z.boolean().optional(),
						validation: z.record(z.unknown()).optional(),
						options: z.array(z.record(z.unknown())).optional(),
						constraints: z.record(z.unknown()).optional(),
						relationConfig: z.record(z.unknown()).optional(),
						rollupConfig: z.record(z.unknown()).optional(),
						agentHint: z.string().optional(),
					}),
				)
				.optional(),
		},
		async (args, extra) => {
			const ctx = getCtx(extra);
			const denied = await requireAdmin(ctx);
			if (denied) return denied;

			const ws = await services.schema.getWorkspaceBySlug(ctx.teamId, args.workspace);
			if (!ws)
				return {
					content: [{ type: 'text', text: `Workspace '${args.workspace}' not found` }],
					isError: true,
				};

			const table = await services.schema.createTable(ctx.teamId, {
				name: args.name,
				slug: args.slug,
				workspaceId: ws.id,
				description: args.description,
				agentHint: args.agentHint,
				sourceLayer: 'workspace',
			});

			if (args.fields) {
				for (let i = 0; i < args.fields.length; i++) {
					const f = args.fields[i];
					await services.schema.createField(ctx.teamId, table.id, {
						name: f.name,
						slug: f.slug,
						fieldType: f.fieldType as any,
						isRequired: f.isRequired,
						isIndexed: f.isIndexed,
						validation: f.validation,
						options: f.options,
						constraints: f.constraints,
						relationConfig: f.relationConfig as any,
						rollupConfig: f.rollupConfig as any,
						agentHint: f.agentHint,
						sourceLayer: 'workspace',
						fieldOrder: i,
					});
				}
			}

			return { content: [{ type: 'text', text: JSON.stringify(table, null, 2) }] };
		},
	);

	mcp.tool(
		'alter_table',
		'Add, remove, or update fields on a table',
		{
			workspace: z.string().optional(),
			table: z.string(),
			addFields: z
				.array(
					z.object({
						name: z.string(),
						slug: z.string(),
						fieldType: z.string(),
						isRequired: z.boolean().optional(),
						isIndexed: z.boolean().optional(),
						validation: z.record(z.unknown()).optional(),
						options: z.array(z.record(z.unknown())).optional(),
						constraints: z.record(z.unknown()).optional(),
						relationConfig: z.record(z.unknown()).optional(),
						rollupConfig: z.record(z.unknown()).optional(),
						agentHint: z.string().optional(),
					}),
				)
				.optional(),
			removeFields: z.array(z.string()).optional(),
			updateFields: z
				.array(
					z.object({
						slug: z.string(),
						name: z.string().optional(),
						agentHint: z.string().optional(),
						isRequired: z.boolean().optional(),
						isIndexed: z.boolean().optional(),
						validation: z.record(z.unknown()).optional(),
						options: z.array(z.record(z.unknown())).optional(),
						constraints: z.record(z.unknown()).optional(),
						relationConfig: z.record(z.unknown()).optional(),
						rollupConfig: z.record(z.unknown()).optional(),
					}),
				)
				.optional(),
		},
		async (args, extra) => {
			const ctx = getCtx(extra);
			const denied = await requireAdmin(ctx);
			if (denied) return denied;

			const tableObj = await resolveTable(ctx.teamId, args.table, args.workspace);
			if (!tableObj)
				return {
					content: [{ type: 'text', text: `Table '${args.table}' not found` }],
					isError: true,
				};

			const result = await services.schema.alterTable(ctx.teamId, tableObj.id, {
				addFields: args.addFields,
				removeFields: args.removeFields,
				updateFields: args.updateFields,
			});

			return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
		},
	);

	mcp.tool(
		'describe_schema',
		'Get a complete schema overview for all workspaces',
		{},
		async (_args, extra) => {
			const ctx = getCtx(extra);
			const denied = await requireAdmin(ctx);
			if (denied) return denied;

			const overview = await services.schema.getSchemaOverview(ctx.teamId);
			return { content: [{ type: 'text', text: JSON.stringify(overview, null, 2) }] };
		},
	);

	mcp.tool('list_workspaces', 'List all workspaces for the team', {}, async (_args, extra) => {
		const ctx = getCtx(extra);
		const workspaces = await services.schema.listWorkspaces(ctx.teamId);
		return { content: [{ type: 'text', text: JSON.stringify(workspaces, null, 2) }] };
	});

	mcp.tool(
		'list_tables',
		'List tables, optionally filtered by workspace',
		{
			workspace: z.string().optional(),
		},
		async (args, extra) => {
			const ctx = getCtx(extra);
			const overview = await services.schema.getSchemaOverview(ctx.teamId);
			const filtered = args.workspace
				? overview.filter((ws: any) => ws.workspace.slug === args.workspace)
				: overview;
			const tables = filtered.flatMap((ws: any) =>
				ws.tables.map((t: any) => ({ workspace: ws.workspace.slug, ...t })),
			);
			return { content: [{ type: 'text', text: JSON.stringify(tables, null, 2) }] };
		},
	);

	mcp.tool(
		'search_global',
		'Full-text search across all records in all workspaces',
		{
			query: z.string(),
			limit: z.number().int().min(1).max(100).default(20),
		},
		async (args, extra) => {
			const ctx = getCtx(extra);
			const overview = await services.schema.getSchemaOverview(ctx.teamId);
			const allResults: any[] = [];
			for (const ws of overview) {
				for (const table of ws.tables) {
					if (allResults.length >= args.limit) break;
					const tableObj = await resolveTable(ctx.teamId, table.slug);
					if (!tableObj) continue;
					const results = await services.search.fullTextSearch({
						teamId: ctx.teamId,
						tableId: tableObj.id,
						query: args.query,
						limit: args.limit - allResults.length,
					});
					allResults.push(
						...results.map((r: any) => ({
							...r,
							_workspace: ws.workspace.slug,
							_table: table.slug,
						})),
					);
				}
			}
			return {
				content: [{ type: 'text', text: JSON.stringify(allResults.slice(0, args.limit), null, 2) }],
			};
		},
	);
}
