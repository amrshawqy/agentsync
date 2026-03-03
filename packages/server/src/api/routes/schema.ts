import { Hono } from 'hono';
import type { ServiceContainer } from '../../services/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/route-authz.js';

export function createSchemaRoutes(services: ServiceContainer): Hono {
	const app = new Hono();

	app.use('/*', authMiddleware);

	// Get schema overview
	app.get('/overview', async (c) => {
		const teamId = c.get('teamId');
		const overview = await services.schema.getSchemaOverview(teamId);
		return c.json({ success: true, data: overview });
	});

	// Create table
	app.post('/tables', async (c) => {
		const denied = await requireAdmin(c, services);
		if (denied) return denied;

		const teamId = c.get('teamId');
		const body = await c.req.json();
		const table = await services.schema.createTable(teamId, body);
		return c.json({ success: true, data: table }, 201);
	});

	// Get table by slug
	app.get('/tables/:workspaceId/:slug', async (c) => {
		const teamId = c.get('teamId');
		const table = await services.schema.getTableBySlug(
			teamId,
			c.req.param('workspaceId'),
			c.req.param('slug'),
		);
		if (!table) return c.json({ error: { code: 'NOT_FOUND', message: 'Table not found' } }, 404);

		const fields = await services.schema.getFieldsForTable(table.id);
		return c.json({ success: true, data: { ...table, fields } });
	});

	// Create field
	app.post('/tables/:tableId/fields', async (c) => {
		const denied = await requireAdmin(c, services);
		if (denied) return denied;

		const teamId = c.get('teamId');
		const body = await c.req.json();
		const field = await services.schema.createField(teamId, c.req.param('tableId'), body);
		return c.json({ success: true, data: field }, 201);
	});

	return app;
}
