import type { RequestContext } from '@agentsync/types';
import { Hono } from 'hono';
import type { ServiceContainer } from '../../services/index.js';
import { parseCsv } from '../../utils/csv-parser.js';
import { authMiddleware } from '../middleware/auth.js';

function getCtx(c: any): RequestContext {
	return {
		teamId: c.get('teamId'),
		userId: c.get('userId'),
		roleId: c.get('roleId'),
		agentId: c.get('agentId'),
		permissions: {},
	};
}

export function createRecordRoutes(services: ServiceContainer): Hono {
	const app = new Hono();

	app.use('/*', authMiddleware);

	// Create record
	app.post('/', async (c) => {
		const ctx = getCtx(c);
		const body = await c.req.json();
		const record = await services.data.createRecord(ctx, body);

		return c.json({ success: true, data: record }, 201);
	});

	// Get record
	app.get('/:id', async (c) => {
		const ctx = getCtx(c);
		const record = await services.data.getRecord(ctx, c.req.param('id'));
		if (!record) return c.json({ error: { code: 'NOT_FOUND', message: 'Record not found' } }, 404);
		return c.json({ success: true, data: record });
	});

	// Update record
	app.patch('/:id', async (c) => {
		const ctx = getCtx(c);
		const body = await c.req.json();
		const record = await services.data.updateRecord(ctx, c.req.param('id'), body);

		return c.json({ success: true, data: record });
	});

	// Delete record
	app.delete('/:id', async (c) => {
		const ctx = getCtx(c);
		const body = await c.req.json().catch(() => ({}));
		await services.data.deleteRecord(ctx, c.req.param('id'), body.reason);

		return c.json({ success: true });
	});

	// Query records
	app.get('/', async (c) => {
		const ctx = getCtx(c);
		const query = c.req.query();
		const result = await services.data.queryRecords(ctx, {
			tableId: query.tableId ?? '',
			filters: query.filters ? JSON.parse(query.filters) : undefined,
			sort: query.sort ? JSON.parse(query.sort) : undefined,
			limit: query.limit ? Number(query.limit) : 50,
			offset: query.offset ? Number(query.offset) : 0,
			search: query.search,
		});

		return c.json({ success: true, ...result });
	});

	// List revisions for a record
	app.get('/:id/revisions', async (c) => {
		const ctx = getCtx(c);
		// Confirm read permission via getRecord (also checks team isolation)
		const record = await services.data.getRecord(ctx, c.req.param('id'));
		if (!record) return c.json({ error: { code: 'NOT_FOUND', message: 'Record not found' } }, 404);

		const limit = c.req.query('limit') ? Number(c.req.query('limit')) : 25;
		const offset = c.req.query('offset') ? Number(c.req.query('offset')) : 0;
		const result = await services.revision.list({
			recordId: c.req.param('id'),
			teamId: ctx.teamId,
			limit,
			offset,
		});
		return c.json({ success: true, ...result });
	});

	// Revert a record to a prior revision
	app.post('/:id/revert', async (c) => {
		const ctx = getCtx(c);
		const body = await c.req.json().catch(() => ({}));
		if (!body.revisionId && !body.to_revision_id) {
			return c.json(
				{ error: { code: 'VALIDATION_ERROR', message: 'revisionId is required' } },
				400,
			);
		}
		const revisionId = (body.revisionId ?? body.to_revision_id) as string;
		try {
			const record = await services.data.revertRecord(ctx, c.req.param('id'), revisionId);
			return c.json({ success: true, data: record });
		} catch (err) {
			return c.json({ error: { code: 'REVERT_FAILED', message: String(err) } }, 400);
		}
	});

	// Get provenance
	app.get('/:id/provenance', async (c) => {
		const ctx = getCtx(c);
		const record = await services.data.getRecord(ctx, c.req.param('id'));
		if (!record) return c.json({ error: { code: 'NOT_FOUND', message: 'Record not found' } }, 404);

		const provenance = record.provenance as Record<string, unknown>;
		const field = c.req.query('field');
		const result = field ? { [field]: provenance[field] } : provenance;
		return c.json({ success: true, data: result });
	});

	// Verify field
	app.post('/:id/verify', async (c) => {
		const ctx = getCtx(c);
		const body = await c.req.json();
		const record = await services.data.verifyField(
			ctx,
			c.req.param('id'),
			body.field,
			body.method,
			body.outcome,
		);

		return c.json({ success: true, data: record });
	});

	// Link records
	app.post('/:id/links', async (c) => {
		const ctx = getCtx(c);
		const body = await c.req.json();
		const relation = await services.relation.link({
			teamId: ctx.teamId,
			sourceRecordId: c.req.param('id'),
			targetRecordId: body.targetRecordId,
			relationType: body.relationType,
			createdBy: ctx.userId,
		});

		return c.json({ success: true, data: relation }, 201);
	});

	// Unlink records
	app.delete('/:id/links/:targetId/:relationType', async (c) => {
		const ctx = getCtx(c);
		const params = c.req.param();
		await services.relation.unlink(ctx.teamId, params.id, params.targetId, params.relationType);
		return c.json({ success: true });
	});

	// Traverse
	app.get('/:id/traverse', async (c) => {
		const ctx = getCtx(c);
		const query = c.req.query();
		const path = query.path?.split('.') ?? [];
		const results = await services.relation.traverse(
			c.req.param('id'),
			path,
			ctx.teamId,
			query.depth ? Number(query.depth) : 2,
		);

		return c.json({ success: true, data: results });
	});

	// Bulk import (JSON)
	app.post('/bulk', async (c) => {
		const ctx = getCtx(c);
		const body = await c.req.json();
		const records = await services.data.bulkImport(ctx, body.tableId, body.records);
		return c.json({ success: true, data: records, count: records.length }, 201);
	});

	// Bulk import (CSV)
	app.post('/bulk/csv', async (c) => {
		const ctx = getCtx(c);
		const contentType = c.req.header('content-type') ?? '';

		let tableId: string;
		let csvContent: string;
		let fieldMapping: Record<string, string> | undefined;
		let delimiter: string | undefined;

		if (contentType.includes('multipart/form-data')) {
			const formData = await c.req.formData();
			tableId = formData.get('tableId') as string;
			delimiter = (formData.get('delimiter') as string) || undefined;
			const mappingStr = formData.get('fieldMapping') as string;
			if (mappingStr) fieldMapping = JSON.parse(mappingStr);
			const file = formData.get('file') as File;
			if (!file)
				return c.json(
					{ error: { code: 'VALIDATION_ERROR', message: 'CSV file is required' } },
					400,
				);
			csvContent = await file.text();
		} else {
			const body = await c.req.json();
			tableId = body.tableId;
			csvContent = body.csv;
			fieldMapping = body.fieldMapping;
			delimiter = body.delimiter;
		}

		if (!tableId || !csvContent) {
			return c.json(
				{ error: { code: 'VALIDATION_ERROR', message: 'tableId and csv content are required' } },
				400,
			);
		}

		const parsed = parseCsv(csvContent, { fieldMapping, delimiter });
		if (parsed.length === 0) {
			return c.json(
				{ error: { code: 'VALIDATION_ERROR', message: 'CSV file contains no data rows' } },
				400,
			);
		}

		const records = await services.data.bulkImport(ctx, tableId, parsed);
		return c.json({ success: true, data: records, count: records.length }, 201);
	});

	return app;
}
