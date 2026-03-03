import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ServiceContainer } from '../../services/index.js';
import type { RequestContext } from '@agentsync/types';
import { parseCsvBase64 } from '../../utils/csv-parser.js';
import { hasAdminAccess } from '../../services/auth/admin-access.js';

export type AuthContextGetter = () => RequestContext;

export function registerTools(mcp: McpServer, services: ServiceContainer, getAuthContext?: AuthContextGetter) {
	const TEAM_SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
	const RESERVED_SLUGS = new Set(['admin', 'api', 'support', 'www', 'status', 'help', 'root']);

	// Helper to build RequestContext — uses auth context from route handler if available
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

	// Helper to resolve table by slug — searches across workspaces when no workspace specified
	async function resolveTable(teamId: string, tableSlug: string, workspaceSlug?: string) {
		if (workspaceSlug) {
			const ws = await services.schema.getWorkspaceBySlug(teamId, workspaceSlug);
			if (!ws) return null;
			return services.schema.getTableBySlug(teamId, ws.id, tableSlug);
		}
		return services.schema.findTableBySlug(teamId, tableSlug);
	}

	function forbiddenResult(message: string = 'FORBIDDEN: Admin role required') {
		return { content: [{ type: 'text' as const, text: message }], isError: true };
	}

	async function requireAdmin(ctx: RequestContext) {
		const allowed = await hasAdminAccess(services.permission, ctx);
		return allowed ? null : forbiddenResult();
	}

	// ── Data Tools ──

	mcp.tool(
		'create_record',
		'Create a new record in a table',
		{
			table: z.string().describe('Table slug'),
			workspace: z.string().optional().describe('Workspace slug (optional — searches all if omitted)'),
			data: z.record(z.unknown()).describe('Field values'),
			confidence: z.number().min(0).max(1).optional().describe('Confidence score for provenance (0-1)'),
			links: z.array(z.object({
				targetRecordId: z.string().uuid(),
				relationType: z.string(),
			})).optional().describe('Optional relations to create'),
		},
		async (args, extra) => {
			const ctx = getCtx(extra);
			const tableObj = await resolveTable(ctx.teamId, args.table, args.workspace);
			if (!tableObj) return { content: [{ type: 'text', text: `Table '${args.table}' not found` }], isError: true };

			const record = await services.data.createRecord(ctx, {
				tableId: tableObj.id,
				data: args.data,
				confidence: args.confidence,
				links: args.links,
			});

			return { content: [{ type: 'text', text: JSON.stringify(record, null, 2) }] };
		},
	);

	mcp.tool(
		'update_record',
		'Update an existing record',
		{
			recordId: z.string().uuid().describe('Record ID'),
			updates: z.record(z.unknown()).describe('Fields to update'),
			confidence: z.number().min(0).max(1).optional().describe('Confidence score for provenance (0-1)'),
		},
		async (args, extra) => {
			const ctx = getCtx(extra);
			const record = await services.data.updateRecord(ctx, args.recordId, {
				data: args.updates,
				confidence: args.confidence,
			});

			return { content: [{ type: 'text', text: JSON.stringify(record, null, 2) }] };
		},
	);

	mcp.tool(
		'delete_record',
		'Soft delete a record',
		{
			recordId: z.string().uuid().describe('Record ID'),
			reason: z.string().optional().describe('Reason for deletion'),
		},
		async (args, extra) => {
			const ctx = getCtx(extra);
			await services.data.deleteRecord(ctx, args.recordId, args.reason);

			return { content: [{ type: 'text', text: `Record ${args.recordId} deleted.` }] };
		},
	);

	mcp.tool(
		'get_record',
		'Fetch a single record with its relations',
		{
			recordId: z.string().uuid().describe('Record ID'),
		},
		async (args, extra) => {
			const ctx = getCtx(extra);
			const record = await services.data.getRecord(ctx, args.recordId);
			if (!record) return { content: [{ type: 'text', text: 'Record not found' }], isError: true };
			return { content: [{ type: 'text', text: JSON.stringify(record, null, 2) }] };
		},
	);

	mcp.tool(
		'query_records',
		'Search and filter records in a table',
		{
			table: z.string().describe('Table slug'),
			workspace: z.string().optional().describe('Workspace slug (optional)'),
			filters: z.record(z.unknown()).optional(),
			sort: z.array(z.object({ field: z.string(), direction: z.enum(['asc', 'desc']).default('asc') })).optional(),
			limit: z.number().int().min(1).max(100).default(20),
			offset: z.number().int().min(0).default(0),
			search: z.string().optional().describe('Full-text search query'),
		},
		async (args, extra) => {
			const ctx = getCtx(extra);
			const tableObj = await resolveTable(ctx.teamId, args.table, args.workspace);
			if (!tableObj) return { content: [{ type: 'text', text: `Table '${args.table}' not found` }], isError: true };

			const result = await services.data.queryRecords(ctx, {
				tableId: tableObj.id,
				filters: args.filters,
				sort: args.sort,
				limit: args.limit,
				offset: args.offset,
				search: args.search,
			});

			return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
		},
	);

	mcp.tool(
		'link_records',
		'Create a relation between two records',
		{
			sourceRecordId: z.string().uuid(),
			targetRecordId: z.string().uuid(),
			relationType: z.string(),
		},
		async (args, extra) => {
			const ctx = getCtx(extra);
			const relation = await services.relation.link({
				teamId: ctx.teamId,
				sourceRecordId: args.sourceRecordId,
				targetRecordId: args.targetRecordId,
				relationType: args.relationType,
				createdBy: ctx.userId,
			});

			// Emit relation.added event
			await services.event.emit({
				eventType: 'relation.added',
				teamId: ctx.teamId,
				data: {
					sourceRecordId: args.sourceRecordId,
					targetRecordId: args.targetRecordId,
					relationType: args.relationType,
				},
			});

			return { content: [{ type: 'text', text: JSON.stringify(relation, null, 2) }] };
		},
	);

	mcp.tool(
		'unlink_records',
		'Remove a relation between two records',
		{
			sourceRecordId: z.string().uuid(),
			targetRecordId: z.string().uuid(),
			relationType: z.string(),
		},
		async (args, extra) => {
			const ctx = getCtx(extra);
			await services.relation.unlink(
				ctx.teamId,
				args.sourceRecordId,
				args.targetRecordId,
				args.relationType,
			);

			// Emit relation.removed event
			await services.event.emit({
				eventType: 'relation.removed',
				teamId: ctx.teamId,
				data: {
					sourceRecordId: args.sourceRecordId,
					targetRecordId: args.targetRecordId,
					relationType: args.relationType,
				},
			});

			return { content: [{ type: 'text', text: 'Unlinked.' }] };
		},
	);

	mcp.tool(
		'traverse',
		'Traverse record relations following a path',
		{
			startRecordId: z.string().uuid(),
			path: z.string().describe('Dot-separated relation path'),
			depth: z.number().int().min(1).max(5).default(2),
		},
		async (args, extra) => {
			const ctx = getCtx(extra);
			const results = await services.relation.traverse(
				args.startRecordId,
				args.path.split('.'),
				ctx.teamId,
				args.depth,
			);

			return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
		},
	);

	mcp.tool(
		'verify_field',
		'Verify a field value on a record',
		{
			recordId: z.string().uuid(),
			field: z.string(),
			method: z.string().describe('Verification method used'),
			outcome: z.enum(['valid', 'invalid', 'unconfirmed']),
		},
		async (args, extra) => {
			const ctx = getCtx(extra);
			const record = await services.data.verifyField(ctx, args.recordId, args.field, args.method, args.outcome);
			return { content: [{ type: 'text', text: JSON.stringify(record.provenance, null, 2) }] };
		},
	);

	mcp.tool(
		'bulk_import',
		'Import multiple records into a table. Provide either `records` (JSON array) or `csvBase64` (base64-encoded CSV string) — they are mutually exclusive.',
		{
			table: z.string().describe('Table slug'),
			workspace: z.string().optional().describe('Workspace slug (optional)'),
			records: z.array(z.record(z.unknown())).min(1).max(1000).optional().describe('JSON records to import (mutually exclusive with csvBase64)'),
			csvBase64: z.string().optional().describe('Base64-encoded CSV content (mutually exclusive with records)'),
			fieldMapping: z.record(z.string()).optional().describe('Map CSV column names to table field slugs'),
			delimiter: z.string().optional().describe('CSV delimiter (default: comma)'),
		},
		async (args, extra) => {
			const ctx = getCtx(extra);
			const tableObj = await resolveTable(ctx.teamId, args.table, args.workspace);
			if (!tableObj) return { content: [{ type: 'text', text: `Table '${args.table}' not found` }], isError: true };

			let importRecords: Record<string, unknown>[];

			if (args.csvBase64) {
				if (args.records) {
					return { content: [{ type: 'text', text: 'Provide either `records` or `csvBase64`, not both.' }], isError: true };
				}
				importRecords = parseCsvBase64(args.csvBase64, {
					fieldMapping: args.fieldMapping,
					delimiter: args.delimiter,
				});
				if (importRecords.length === 0) {
					return { content: [{ type: 'text', text: 'CSV contains no data rows.' }], isError: true };
				}
			} else if (args.records) {
				importRecords = args.records;
			} else {
				return { content: [{ type: 'text', text: 'Provide either `records` or `csvBase64`.' }], isError: true };
			}

			const created = await services.data.bulkImport(ctx, tableObj.id, importRecords);
			return { content: [{ type: 'text', text: `Imported ${created.length} records.` }] };
		},
	);

	// ── Schema Tools ──

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
			if (!tableObj) return { content: [{ type: 'text', text: `Table '${args.table}' not found` }], isError: true };

			const fields = await services.schema.getFieldsForTable(tableObj.id);
			return { content: [{ type: 'text', text: JSON.stringify({ ...tableObj, fields }, null, 2) }] };
		},
	);

	// ── Event Tools ──

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
			// Resolve table to get tableId if table slug provided
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

	// ── Suggestion Tools ──

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
			if (!tableObj) return { content: [{ type: 'text', text: `Table '${args.table}' not found` }], isError: true };

			const slug = args.fieldName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
			const suggestion = await services.suggestion.suggest(ctx.teamId, ctx.userId, {
				tableId: tableObj.id,
				fieldName: args.fieldName,
				fieldSlug: slug,
				fieldType: args.fieldType as any,
				rationale: args.rationale,
				exampleValue: args.exampleValue,
			});

			return { content: [{ type: 'text', text: `Field suggestion submitted (ID: ${suggestion.id}). Awaiting admin approval.` }] };
		},
	);

	// ── Blueprint Tools ──

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

			// Emit blueprint.deployed event
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

			return { content: [{ type: 'text', text: `Blueprint deployed. Workspace: ${workspace.name} (${workspace.slug})` }] };
		},
	);

	// ── Agent Kit Tools ──

	mcp.tool(
		'get_agent_kit',
		'Generate an Agent Kit for a target platform',
		{
			format: z.enum(['claude-desktop', 'claude-code', 'cursor', 'chatgpt', 'raw']).describe('Target platform'),
			memberId: z.string().uuid().optional().describe('Generate kit for a specific member (defaults to current user)'),
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

	// ── Audit Tools ──

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

	// ── Member Tools ──

	mcp.tool(
		'list_members',
		'List team members',
		{},
		async (_args, extra) => {
			const ctx = getCtx(extra);
			const denied = await requireAdmin(ctx);
			if (denied) return denied;

			const members = await services.user.listByTeam(ctx.teamId);
			return { content: [{ type: 'text', text: JSON.stringify(members, null, 2) }] };
		},
	);

	mcp.tool(
		'add_member',
		'Add a new member to the team',
		{
			email: z.string().email(),
			name: z.string().optional(),
			roleId: z.string().uuid().optional(),
		},
		async (args, extra) => {
			const ctx = getCtx(extra);
			const denied = await requireAdmin(ctx);
			if (denied) return denied;

			const member = await services.user.create(ctx.teamId, args);
			return { content: [{ type: 'text', text: JSON.stringify(member, null, 2) }] };
		},
	);

	// ── Schema Management Tools ──

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
			// Direct workspace creation via schema service
			const ws = await services.schema.createWorkspace(ctx.teamId, args.name, args.slug);
			return { content: [{ type: 'text', text: JSON.stringify(ws, null, 2) }] };
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
				tables: z.array(z.object({
					slug: z.string(),
					name: z.string(),
					description: z.string().optional(),
					agentHint: z.string().optional(),
					fields: z.array(z.object({
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
					})),
				})),
		},
		async (args, extra) => {
			const ctx = getCtx(extra);
			const denied = await requireAdmin(ctx);
			if (denied) return denied;

			const bp = await services.blueprint.create({
				slug: args.slug,
				name: args.name,
				description: args.description,
				category: args.category,
				schemaDefinition: { tables: args.tables },
			}, ctx.teamId);
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

			// Emit blueprint.evolved event
			await services.event.emit({
				eventType: 'blueprint.evolved',
				teamId: ctx.teamId,
				data: {
					blueprintSlug: args.blueprintSlug,
					newVersion: evolved.version,
				},
			});

			return { content: [{ type: 'text', text: `Blueprint evolved to v${evolved.version}. ID: ${evolved.id}` }] };
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
			return { content: [{ type: 'text', text: `Blueprint '${bp.slug}' published to marketplace.` }] };
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
			fields: z.array(z.object({
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
			})).optional(),
		},
		async (args, extra) => {
			const ctx = getCtx(extra);
			const denied = await requireAdmin(ctx);
			if (denied) return denied;

			const ws = await services.schema.getWorkspaceBySlug(ctx.teamId, args.workspace);
			if (!ws) return { content: [{ type: 'text', text: `Workspace '${args.workspace}' not found` }], isError: true };

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
			addFields: z.array(z.object({
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
			})).optional(),
			removeFields: z.array(z.string()).optional(),
			updateFields: z.array(z.object({
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
			})).optional(),
		},
		async (args, extra) => {
			const ctx = getCtx(extra);
			const denied = await requireAdmin(ctx);
			if (denied) return denied;

			const tableObj = await resolveTable(ctx.teamId, args.table, args.workspace);
			if (!tableObj) return { content: [{ type: 'text', text: `Table '${args.table}' not found` }], isError: true };

			const result = await services.schema.alterTable(ctx.teamId, tableObj.id, {
				addFields: args.addFields,
				removeFields: args.removeFields,
				updateFields: args.updateFields,
			});

			return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
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
			let all = [...builtin, ...published];
			const unique = Array.from(new Map(all.map((b) => [b.id, b])).values());
			const filtered = args.category ? unique.filter((b) => b.category === args.category) : unique;
			return { content: [{ type: 'text', text: JSON.stringify(filtered.map((b) => ({
				slug: b.slug, name: b.name, description: b.description, category: b.category, version: b.version,
			})), null, 2) }] };
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

	// ── Context & Discovery Tools ──

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
		'list_workspaces',
		'List all workspaces for the team',
		{},
		async (_args, extra) => {
			const ctx = getCtx(extra);
			const workspaces = await services.schema.listWorkspaces(ctx.teamId);
			return { content: [{ type: 'text', text: JSON.stringify(workspaces, null, 2) }] };
		},
	);

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
			// Search across all workspaces by querying JSONB data directly
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
					allResults.push(...results.map((r: any) => ({
						...r,
						_workspace: ws.workspace.slug,
						_table: table.slug,
					})));
				}
			}
			return { content: [{ type: 'text', text: JSON.stringify(allResults.slice(0, args.limit), null, 2) }] };
		},
	);

	// ── Member & Permission Tools ──

	mcp.tool(
		'update_member_role',
		'Change a member\'s role',
		{
			userId: z.string().uuid(),
			roleId: z.string().uuid(),
		},
		async (args, extra) => {
			const ctx = getCtx(extra);
			const denied = await requireAdmin(ctx);
			if (denied) return denied;

			const updated = await services.user.update(args.userId, { roleId: args.roleId });
			return { content: [{ type: 'text', text: JSON.stringify(updated, null, 2) }] };
		},
	);

	mcp.tool(
		'create_role',
		'Create a new role with permissions',
		{
			name: z.string(),
			permissions: z.record(z.unknown()),
		},
		async (args, extra) => {
			const ctx = getCtx(extra);
			const denied = await requireAdmin(ctx);
			if (denied) return denied;

			const role = await services.team.createRole(ctx.teamId, args.name, args.permissions);
			return { content: [{ type: 'text', text: JSON.stringify(role, null, 2) }] };
		},
	);

	mcp.tool(
		'set_field_access',
		'Configure field-level access for a role on a table',
		{
			roleId: z.string().uuid(),
			workspace: z.string(),
			table: z.string(),
			hidden: z.array(z.string()).optional(),
			readOnly: z.array(z.string()).optional(),
		},
		async (args, extra) => {
			const ctx = getCtx(extra);
			const denied = await requireAdmin(ctx);
			if (denied) return denied;

			const updated = await services.team.updateRoleFieldAccess(
				args.roleId, args.workspace, args.table,
				{ hidden: args.hidden, readOnly: args.readOnly },
			);
			return { content: [{ type: 'text', text: JSON.stringify(updated, null, 2) }] };
		},
	);

	// ── Schema Suggestion Tools ──

	mcp.tool(
		'list_suggestions',
		'List pending field suggestions',
		{},
		async (_args, extra) => {
			const ctx = getCtx(extra);
			const isAdmin = await hasAdminAccess(services.permission, ctx);
			const suggestions = isAdmin
				? await services.suggestion.listPending(ctx.teamId)
				: await services.suggestion.listPendingByUser(ctx.teamId, ctx.userId);
			return { content: [{ type: 'text', text: JSON.stringify(suggestions, null, 2) }] };
		},
	);

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

			const result = await services.suggestion.approve(args.suggestionId, ctx.teamId, ctx.userId, args.note);
			return { content: [{ type: 'text', text: `Suggestion approved. Field created: ${JSON.stringify(result, null, 2)}` }] };
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

	// ── Automation Tools ──

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
			return { content: [{ type: 'text', text: `Automation ${args.active ? 'enabled' : 'disabled'}: ${updated.name}` }] };
		},
	);

	// ── Audit & Monitoring Tools ──

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

	// ── Marketplace Tools ──

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

	// ── Agent Onboarding Tools ──

	mcp.tool(
		'register_agent_identity',
		'Register an agent key identity. Call once without challengeId to receive challenge, then call with challengeId + signature.',
		{
			publicKeyJwk: z.record(z.unknown()),
			label: z.string().optional(),
			challengeId: z.string().uuid().optional(),
			signature: z.string().optional(),
			createAccountIfMissing: z.boolean().default(true),
		},
		async (args) => {
			if (!args.challengeId) {
				const challenge = await services.agentIdentity.createChallenge(args.publicKeyJwk, args.label);
				return { content: [{ type: 'text', text: JSON.stringify({ step: 'sign_challenge', ...challenge }, null, 2) }] };
			}
			if (!args.signature) {
				return { content: [{ type: 'text', text: 'signature is required when challengeId is provided' }], isError: true };
			}

			const registration = await services.agentIdentity.registerFromChallenge({
				challengeId: args.challengeId,
				publicKeyJwk: args.publicKeyJwk,
				signature: args.signature,
				createAccountIfMissing: args.createAccountIfMissing,
			});
			const tokens = await services.agentIdentity.issueOnboardingTokens(
				registration.accountId,
				registration.agentId,
			);

			return {
				content: [{
					type: 'text',
					text: JSON.stringify({
						accountId: registration.accountId,
						agentId: registration.agentId,
						accessToken: tokens.accessToken,
						refreshToken: tokens.refreshToken,
						expiresIn: tokens.expiresIn,
					}, null, 2),
				}],
			};
		},
	);

	mcp.tool(
		'get_my_profile',
		'Get current account profile, team memberships, and linked agents',
		{},
		async (_args, extra) => {
			const ctx = getCtx(extra);
			const accountId = await resolveAccountId(ctx);
			if (!accountId) return { content: [{ type: 'text', text: 'No account context in token' }], isError: true };

			const profile = await services.agentIdentity.getProfile(accountId);
			if (!profile) return { content: [{ type: 'text', text: 'Account not found' }], isError: true };
			return { content: [{ type: 'text', text: JSON.stringify(profile, null, 2) }] };
		},
	);

	mcp.tool(
		'list_my_teams',
		'List the teams the current account belongs to',
		{},
		async (_args, extra) => {
			const ctx = getCtx(extra);
			const accountId = await resolveAccountId(ctx);
			if (!accountId) return { content: [{ type: 'text', text: 'No account context in token' }], isError: true };
			const memberships = await services.account.listMemberships(accountId);
			return { content: [{ type: 'text', text: JSON.stringify(memberships, null, 2) }] };
		},
	);

	mcp.tool(
		'create_team',
		'Create a new team and become its admin',
		{
			name: z.string().min(1).max(255),
			slug: z.string().min(3).max(32),
		},
		async (args, extra) => {
			const ctx = getCtx(extra);
			const accountId = await resolveAccountId(ctx);
			if (!accountId) return { content: [{ type: 'text', text: 'No account context in token' }], isError: true };

			const slug = args.slug.toLowerCase();
			if (!TEAM_SLUG_REGEX.test(slug) || RESERVED_SLUGS.has(slug)) {
				return { content: [{ type: 'text', text: 'Invalid or reserved team slug' }], isError: true };
			}

			const account = await services.account.getById(accountId);
			if (!account) return { content: [{ type: 'text', text: 'Account not found' }], isError: true };

			if (account.limitsTier !== 'verified') {
				const memberships = await services.account.countMemberships(accountId);
				if (memberships >= 1) {
					return {
						content: [{ type: 'text', text: 'Unverified accounts can only create one team. Verify email to unlock more.' }],
						isError: true,
					};
				}
			}

			const existing = await services.team.getBySlug(slug);
			if (existing) return { content: [{ type: 'text', text: 'Team slug already in use' }], isError: true };

			const team = await services.team.create({ name: args.name, slug });
			const adminRole = await services.team.getRoleByName(team.id, 'admin');
			if (!adminRole) return { content: [{ type: 'text', text: 'Failed to resolve admin role' }], isError: true };

			const membershipEmail = account.primaryEmail ?? `${account.id.slice(0, 12)}@agent.local`;
			const membership = await services.user.create(team.id, {
				accountId,
				email: membershipEmail,
				roleId: adminRole.id,
			});
			await services.user.update(membership.id, { status: 'active' });

			const teamToken = await services.agentIdentity.issueTeamToken({
				accountId,
				teamId: team.id,
				agentId: ctx.agentId,
			});

			return {
				content: [{
					type: 'text',
					text: JSON.stringify({
						team,
						membership: { ...membership, status: 'active' },
						accessToken: teamToken.accessToken,
						expiresIn: teamToken.expiresIn,
					}, null, 2),
				}],
			};
		},
	);

	mcp.tool(
		'switch_team',
		'Issue a team-scoped token for one of your teams',
		{
			teamId: z.string().uuid().optional(),
			teamSlug: z.string().optional(),
		},
		async (args, extra) => {
			const ctx = getCtx(extra);
			const accountId = await resolveAccountId(ctx);
			if (!accountId) return { content: [{ type: 'text', text: 'No account context in token' }], isError: true };

			let teamId = args.teamId;
			if (!teamId && args.teamSlug) {
				teamId = (await services.team.getBySlug(args.teamSlug))?.id;
			}
			if (!teamId) return { content: [{ type: 'text', text: 'Provide teamId or teamSlug' }], isError: true };

			const teamToken = await services.agentIdentity.issueTeamToken({
				accountId,
				teamId,
				agentId: ctx.agentId,
			});
			return { content: [{ type: 'text', text: JSON.stringify(teamToken, null, 2) }] };
		},
	);

	mcp.tool(
		'invite_member',
		'Create a team invite code for a new member',
		{
			email: z.string().email().optional(),
			roleId: z.string().uuid().optional(),
			expiresInDays: z.number().int().min(1).max(30).optional(),
		},
		async (args, extra) => {
			const ctx = getCtx(extra);
			const denied = await requireAdmin(ctx);
			if (denied) return denied;

			const roleId = args.roleId ?? (await services.team.getRoleByName(ctx.teamId, 'member'))?.id;
			if (!roleId) return { content: [{ type: 'text', text: 'roleId is required' }], isError: true };

			const invite = await services.invite.createInvite({
				teamId: ctx.teamId,
				roleId,
				invitedByUserId: ctx.userId,
				email: args.email,
				expiresInDays: args.expiresInDays,
			});
			return { content: [{ type: 'text', text: JSON.stringify(invite, null, 2) }] };
		},
	);

	mcp.tool(
		'accept_team_invite',
		'Accept a team invite code and join the team',
		{
			inviteCode: z.string(),
		},
		async (args, extra) => {
			const ctx = getCtx(extra);
			const accountId = await resolveAccountId(ctx);
			if (!accountId) return { content: [{ type: 'text', text: 'No account context in token' }], isError: true };

			const accepted = await services.invite.acceptInvite({ accountId, inviteCode: args.inviteCode });
			const teamToken = await services.agentIdentity.issueTeamToken({
				accountId,
				teamId: accepted.teamId,
				agentId: ctx.agentId,
			});
			return {
				content: [{ type: 'text', text: JSON.stringify({ ...accepted, accessToken: teamToken.accessToken }, null, 2) }],
			};
		},
	);

	mcp.tool(
		'start_email_verification',
		'Start OTP verification for an email address (optional, unlocks higher limits)',
		{
			email: z.string().email(),
		},
		async (args, extra) => {
			const ctx = getCtx(extra);
			const accountId = await resolveAccountId(ctx);
			if (!accountId) return { content: [{ type: 'text', text: 'No account context in token' }], isError: true };
			const challenge = await services.emailVerification.start(accountId, args.email);
			return { content: [{ type: 'text', text: JSON.stringify(challenge, null, 2) }] };
		},
	);

	mcp.tool(
		'verify_email_otp',
		'Verify OTP code and upgrade account limits tier',
		{
			challengeId: z.string().uuid(),
			otp: z.string().regex(/^\d{6}$/),
		},
		async (args, extra) => {
			const ctx = getCtx(extra);
			const accountId = await resolveAccountId(ctx);
			if (!accountId) return { content: [{ type: 'text', text: 'No account context in token' }], isError: true };
			const updated = await services.emailVerification.verify(accountId, args.challengeId, args.otp);
			return { content: [{ type: 'text', text: JSON.stringify({ verified: true, limitsTier: updated?.limitsTier }, null, 2) }] };
		},
	);
}
