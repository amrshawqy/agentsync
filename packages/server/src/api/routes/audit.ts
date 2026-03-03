import { Hono } from 'hono';
import type { ServiceContainer } from '../../services/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/route-authz.js';

export function createAuditRoutes(services: ServiceContainer): Hono {
	const app = new Hono();

	app.use('/*', authMiddleware);

	app.get('/', async (c) => {
		const denied = await requireAdmin(c, services);
		if (denied) return denied;

		const query = c.req.query();
		const result = await services.audit.query({
			teamId: c.get('teamId'),
			resourceType: query.resourceType,
			resourceId: query.resourceId,
			action: query.action,
			userId: query.userId,
			limit: query.limit ? Number(query.limit) : 50,
			offset: query.offset ? Number(query.offset) : 0,
		});

		return c.json({ success: true, ...result });
	});

	return app;
}
