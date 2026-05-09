import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ServiceContainer } from '../../services/index.js';

export function registerResources(mcp: McpServer, services: ServiceContainer) {
	mcp.resource(
		'schema-overview',
		'agentsync://schema/overview',
		{
			description: 'Full accessible schema with workspaces, tables, fields, hints, and constraints',
		},
		async (uri, extra) => {
			const teamId = (extra as any)?.teamId ?? '';
			const overview = await services.schema.getSchemaOverview(teamId);

			return {
				contents: [
					{
						uri: uri.href,
						mimeType: 'application/json',
						text: JSON.stringify(overview, null, 2),
					},
				],
			};
		},
	);

	mcp.resource(
		'instructions',
		'agentsync://instructions',
		{ description: 'Assembled contextual instructions for the current agent' },
		async (uri, extra) => {
			const teamId = (extra as any)?.teamId ?? '';
			const roleId = (extra as any)?.roleId ?? '';
			const assembled = await services.instruction.assemble(teamId, roleId);

			return {
				contents: [
					{
						uri: uri.href,
						mimeType: 'text/plain',
						text: assembled,
					},
				],
			};
		},
	);

	mcp.resource(
		'workspace-stats',
		'agentsync://workspace/{slug}/stats',
		{ description: 'Workspace statistics: record counts, table count' },
		async (uri, extra) => {
			const teamId = (extra as any)?.teamId ?? '';
			// Extract slug from URI
			const match = uri.href.match(/workspace\/([^/]+)\/stats/);
			const slug = match?.[1] ?? '';
			try {
				const stats = await services.schema.getWorkspaceStats(teamId, slug);
				return {
					contents: [
						{
							uri: uri.href,
							mimeType: 'application/json',
							text: JSON.stringify(stats, null, 2),
						},
					],
				};
			} catch {
				return {
					contents: [
						{
							uri: uri.href,
							mimeType: 'application/json',
							text: JSON.stringify({ error: 'Workspace not found' }),
						},
					],
				};
			}
		},
	);

	mcp.resource(
		'blueprint-catalog',
		'agentsync://blueprints/catalog',
		{ description: 'Available blueprints catalog' },
		async (uri) => {
			const builtin = await services.blueprint.listBuiltin();
			const published = await services.blueprint.listPublished();
			const all = [...builtin, ...published];
			const unique = Array.from(new Map(all.map((b) => [b.id, b])).values());

			return {
				contents: [
					{
						uri: uri.href,
						mimeType: 'application/json',
						text: JSON.stringify(
							unique.map((b) => ({
								slug: b.slug,
								name: b.name,
								description: b.description,
								category: b.category,
								version: b.version,
								isBuiltin: b.isBuiltin,
							})),
							null,
							2,
						),
					},
				],
			};
		},
	);
}
