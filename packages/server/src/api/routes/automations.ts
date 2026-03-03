import { Hono } from 'hono';
import type { ServiceContainer } from '../../services/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { getRequestContext, requireAdmin } from '../middleware/route-authz.js';

export function createAutomationRoutes(services: ServiceContainer): Hono {
	const app = new Hono();

	app.use('*', authMiddleware);

	// List automations
	app.get('/', async (c) => {
		const denied = await requireAdmin(c, services);
		if (denied) return denied;

		const ctx = getRequestContext(c);
		const workspaceId = c.req.query('workspaceId');
		const automations = await services.automation.list(ctx.teamId, workspaceId);
		return c.json({ data: automations });
	});

	// Create automation
	app.post('/', async (c) => {
		const denied = await requireAdmin(c, services);
		if (denied) return denied;

		const ctx = getRequestContext(c);
		const body = await c.req.json();
		const automation = await services.automation.create(ctx.teamId, ctx.userId, body);
		return c.json({ data: automation }, 201);
	});

	// Toggle automation
	app.patch('/:id/toggle', async (c) => {
		const denied = await requireAdmin(c, services);
		if (denied) return denied;

		const ctx = getRequestContext(c);
		const { active } = await c.req.json();
		const updated = await services.automation.toggle(c.req.param('id'), ctx.teamId, active);
		return c.json({ data: updated });
	});

	return app;
}
