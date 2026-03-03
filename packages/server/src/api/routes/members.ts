import { Hono } from 'hono';
import type { ServiceContainer } from '../../services/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/route-authz.js';

export function createMemberRoutes(services: ServiceContainer): Hono {
	const app = new Hono();

	app.use('/*', authMiddleware);

	app.get('/', async (c) => {
		const denied = await requireAdmin(c, services);
		if (denied) return denied;

		const members = await services.user.listByTeam(c.get('teamId'));
		return c.json({ success: true, data: members });
	});

	app.post('/', async (c) => {
		const denied = await requireAdmin(c, services);
		if (denied) return denied;

		const body = await c.req.json();
		const member = await services.user.create(c.get('teamId'), body);
		return c.json({ success: true, data: member }, 201);
	});

	// Roles
	app.get('/roles', async (c) => {
		const denied = await requireAdmin(c, services);
		if (denied) return denied;

		const roles = await services.user.getRolesForTeam(c.get('teamId'));
		return c.json({ success: true, data: roles });
	});

	app.get('/:id', async (c) => {
		const denied = await requireAdmin(c, services);
		if (denied) return denied;

		const member = await services.user.getById(c.req.param('id'));
		if (!member) return c.json({ error: { code: 'NOT_FOUND', message: 'Member not found' } }, 404);
		return c.json({ success: true, data: member });
	});

	app.patch('/:id', async (c) => {
		const denied = await requireAdmin(c, services);
		if (denied) return denied;

		const body = await c.req.json();
		const member = await services.user.update(c.req.param('id'), body);
		if (!member) return c.json({ error: { code: 'NOT_FOUND', message: 'Member not found' } }, 404);
		return c.json({ success: true, data: member });
	});

	app.delete('/:id', async (c) => {
		const denied = await requireAdmin(c, services);
		if (denied) return denied;

		await services.user.delete(c.req.param('id'));
		return c.json({ success: true });
	});

	return app;
}
