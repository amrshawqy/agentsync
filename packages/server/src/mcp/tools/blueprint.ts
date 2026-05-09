import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ToolHelpers } from './shared.js';

export function registerBlueprintTools(mcp: McpServer, h: ToolHelpers) {
	const { services, getCtx, requireAdmin } = h;

	mcp.tool(
		'deploy_blueprint',
		'Deploy a blueprint to create a new workspace',
		{
			blueprintSlug: z.string(),
			workspaceName: z.string().optional(),
			workspaceSlug: z.string().optional(),
			includeSeedData: z.boolean().default(false),
		},
		async (args, extra) => {
			const ctx = getCtx(extra);
			const denied = await requireAdmin(ctx);
			if (denied) return denied;

			const workspace = await services.blueprint.deploy(ctx.teamId, args.blueprintSlug, {
				workspaceName: args.workspaceName,
				workspaceSlug: args.workspaceSlug,
				includeSeedData: args.includeSeedData,
			});

			await services.event.emit({
				eventType: 'blueprint.deployed',
				teamId: ctx.teamId,
				workspace: workspace.slug,
				data: {
					blueprintSlug: args.blueprintSlug,
					workspaceSlug: workspace.slug,
					workspaceName: workspace.name,
				},
			});

			return {
				content: [
					{
						type: 'text',
						text: `Blueprint deployed. Workspace: ${workspace.name} (${workspace.slug})`,
					},
				],
			};
		},
	);

	mcp.tool(
		'list_blueprints',
		'List available blueprints',
		{
			category: z.string().optional(),
		},
		async (args, extra) => {
			const ctx = getCtx(extra);
			const denied = await requireAdmin(ctx);
			if (denied) return denied;

			const builtin = await services.blueprint.listBuiltin();
			const published = await services.blueprint.listPublished();
			const all = [...builtin, ...published];
			const unique = Array.from(new Map(all.map((b) => [b.id, b])).values());
			const filtered = args.category ? unique.filter((b) => b.category === args.category) : unique;
			return {
				content: [
					{
						type: 'text',
						text: JSON.stringify(
							filtered.map((b) => ({
								slug: b.slug,
								name: b.name,
								description: b.description,
								category: b.category,
								version: b.version,
							})),
							null,
							2,
						),
					},
				],
			};
		},
	);

	mcp.tool(
		'create_blueprint',
		'Create a new blueprint definition',
		{
			slug: z.string(),
			name: z.string(),
			description: z.string().optional(),
			category: z.string().optional(),
			tables: z.array(
				z.object({
					slug: z.string(),
					name: z.string(),
					description: z.string().optional(),
					agentHint: z.string().optional(),
					fields: z.array(
						z.object({
							slug: z.string(),
							name: z.string(),
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
					),
				}),
			),
		},
		async (args, extra) => {
			const ctx = getCtx(extra);
			const denied = await requireAdmin(ctx);
			if (denied) return denied;

			const bp = await services.blueprint.create(
				{
					slug: args.slug,
					name: args.name,
					description: args.description,
					category: args.category,
					schemaDefinition: { tables: args.tables },
				},
				ctx.teamId,
			);
			return { content: [{ type: 'text', text: JSON.stringify(bp, null, 2) }] };
		},
	);

	mcp.tool(
		'evolve_blueprint',
		'Create a new version of a blueprint with schema changes',
		{
			blueprintSlug: z.string(),
			changes: z.record(z.unknown()),
		},
		async (args, extra) => {
			const ctx = getCtx(extra);
			const denied = await requireAdmin(ctx);
			if (denied) return denied;

			const evolved = await services.blueprint.evolve(args.blueprintSlug, args.changes);

			await services.event.emit({
				eventType: 'blueprint.evolved',
				teamId: ctx.teamId,
				data: {
					blueprintSlug: args.blueprintSlug,
					newVersion: evolved.version,
				},
			});

			return {
				content: [
					{ type: 'text', text: `Blueprint evolved to v${evolved.version}. ID: ${evolved.id}` },
				],
			};
		},
	);

	mcp.tool(
		'publish_blueprint',
		'Publish a blueprint to the marketplace',
		{
			slug: z.string().describe('Blueprint slug'),
		},
		async (args, extra) => {
			const ctx = getCtx(extra);
			const denied = await requireAdmin(ctx);
			if (denied) return denied;

			const bp = await services.blueprint.publish(args.slug);
			return {
				content: [{ type: 'text', text: `Blueprint '${bp.slug}' published to marketplace.` }],
			};
		},
	);
}
