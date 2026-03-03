import { Hono } from 'hono';
import type { ServiceContainer } from '../../services/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { getRequestContext, requireAdmin } from '../middleware/route-authz.js';
import { hasAdminAccess } from '../../services/auth/admin-access.js';

export function createSuggestionRoutes(services: ServiceContainer): Hono {
	const app = new Hono();

	app.use('/*', authMiddleware);

	app.get('/', async (c) => {
		const all = c.req.query('all') === 'true';
		const ctx = getRequestContext(c);
		const isAdmin = await hasAdminAccess(services.permission, ctx);

		let suggestions;
		if (isAdmin) {
			suggestions = all
				? await services.suggestion.listAll(ctx.teamId)
				: await services.suggestion.listPending(ctx.teamId);
		} else {
			suggestions = all
				? await services.suggestion.listByUser(ctx.teamId, ctx.userId)
				: await services.suggestion.listPendingByUser(ctx.teamId, ctx.userId);
		}

		return c.json({ success: true, data: suggestions });
	});

	app.post('/', async (c) => {
		const body = await c.req.json();
		const suggestion = await services.suggestion.suggest(c.get('teamId'), c.get('userId'), body);
		return c.json({ success: true, data: suggestion }, 201);
	});

	app.post('/:id/approve', async (c) => {
		const denied = await requireAdmin(c, services);
		if (denied) return denied;

		const body = await c.req.json().catch(() => ({}));
		const suggestion = await services.suggestion.approve(
			c.req.param('id'),
			c.get('teamId'),
			c.get('userId'),
			body.note,
		);
		return c.json({ success: true, data: suggestion });
	});

	app.post('/:id/reject', async (c) => {
		const denied = await requireAdmin(c, services);
		if (denied) return denied;

		const body = await c.req.json().catch(() => ({}));
		const suggestion = await services.suggestion.reject(
			c.req.param('id'),
			c.get('teamId'),
			c.get('userId'),
			body.note,
		);
		return c.json({ success: true, data: suggestion });
	});

	return app;
}
