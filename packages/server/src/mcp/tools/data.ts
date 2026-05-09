import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { parseCsvBase64 } from '../../utils/csv-parser.js';
import type { ToolHelpers } from './shared.js';

export function registerDataTools(mcp: McpServer, h: ToolHelpers) {
	const { services, getCtx, resolveTable } = h;

	mcp.tool(
		'create_record',
		'Create a new record in a table',
		{
			table: z.string().describe('Table slug'),
			workspace: z
				.string()
				.optional()
				.describe('Workspace slug (optional — searches all if omitted)'),
			data: z.record(z.unknown()).describe('Field values'),
			confidence: z
				.number()
				.min(0)
				.max(1)
				.optional()
				.describe('Confidence score for provenance (0-1)'),
			links: z
				.array(
					z.object({
						targetRecordId: z.string().uuid(),
						relationType: z.string(),
					}),
				)
				.optional()
				.describe('Optional relations to create'),
		},
		async (args, extra) => {
			const ctx = getCtx(extra);
			const tableObj = await resolveTable(ctx.teamId, args.table, args.workspace);
			if (!tableObj)
				return {
					content: [{ type: 'text', text: `Table '${args.table}' not found` }],
					isError: true,
				};

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
			confidence: z
				.number()
				.min(0)
				.max(1)
				.optional()
				.describe('Confidence score for provenance (0-1)'),
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
			sort: z
				.array(z.object({ field: z.string(), direction: z.enum(['asc', 'desc']).default('asc') }))
				.optional(),
			limit: z.number().int().min(1).max(100).default(20),
			offset: z.number().int().min(0).default(0),
			search: z.string().optional().describe('Full-text search query'),
		},
		async (args, extra) => {
			const ctx = getCtx(extra);
			const tableObj = await resolveTable(ctx.teamId, args.table, args.workspace);
			if (!tableObj)
				return {
					content: [{ type: 'text', text: `Table '${args.table}' not found` }],
					isError: true,
				};

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
			const record = await services.data.verifyField(
				ctx,
				args.recordId,
				args.field,
				args.method,
				args.outcome,
			);
			return { content: [{ type: 'text', text: JSON.stringify(record.provenance, null, 2) }] };
		},
	);

	mcp.tool(
		'bulk_import',
		'Import multiple records into a table. Provide either `records` (JSON array) or `csvBase64` (base64-encoded CSV string) — they are mutually exclusive.',
		{
			table: z.string().describe('Table slug'),
			workspace: z.string().optional().describe('Workspace slug (optional)'),
			records: z
				.array(z.record(z.unknown()))
				.min(1)
				.max(1000)
				.optional()
				.describe('JSON records to import (mutually exclusive with csvBase64)'),
			csvBase64: z
				.string()
				.optional()
				.describe('Base64-encoded CSV content (mutually exclusive with records)'),
			fieldMapping: z
				.record(z.string())
				.optional()
				.describe('Map CSV column names to table field slugs'),
			delimiter: z.string().optional().describe('CSV delimiter (default: comma)'),
		},
		async (args, extra) => {
			const ctx = getCtx(extra);
			const tableObj = await resolveTable(ctx.teamId, args.table, args.workspace);
			if (!tableObj)
				return {
					content: [{ type: 'text', text: `Table '${args.table}' not found` }],
					isError: true,
				};

			let importRecords: Record<string, unknown>[];

			if (args.csvBase64) {
				if (args.records) {
					return {
						content: [{ type: 'text', text: 'Provide either `records` or `csvBase64`, not both.' }],
						isError: true,
					};
				}
				importRecords = parseCsvBase64(args.csvBase64, {
					fieldMapping: args.fieldMapping,
					delimiter: args.delimiter,
				});
				if (importRecords.length === 0) {
					return {
						content: [{ type: 'text', text: 'CSV contains no data rows.' }],
						isError: true,
					};
				}
			} else if (args.records) {
				importRecords = args.records;
			} else {
				return {
					content: [{ type: 'text', text: 'Provide either `records` or `csvBase64`.' }],
					isError: true,
				};
			}

			const created = await services.data.bulkImport(ctx, tableObj.id, importRecords);
			return { content: [{ type: 'text', text: `Imported ${created.length} records.` }] };
		},
	);
}
