import { Hono } from 'hono';
import type { ServiceContainer } from '../../services/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { workspaces } from '@agentsync/db';
import { eq } from 'drizzle-orm';

export function createWorkspaceRoutes(services: ServiceContainer): Hono {
	const app = new Hono();

	app.use('/*', authMiddleware);

	app.get('/', async (c) => {
		const overview = await services.schema.getSchemaOverview(c.get('teamId'));
		return c.json({ success: true, data: overview.map((ws: any) => ws.workspace) });
	});

	return app;
}
