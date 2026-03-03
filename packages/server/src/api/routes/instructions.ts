import { Hono } from 'hono';
import type { ServiceContainer } from '../../services/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/route-authz.js';

export function createInstructionRoutes(services: ServiceContainer): Hono {
	const app = new Hono();

	app.use('/*', authMiddleware);

	app.get('/assembled', async (c) => {
		const assembled = await services.instruction.assemble(c.get('teamId'), c.get('roleId'));
		return c.json({ success: true, data: assembled });
	});

	app.get('/', async (c) => {
		const list = await services.instruction.list(c.get('teamId'));
		return c.json({ success: true, data: list });
	});

	app.post('/', async (c) => {
		const denied = await requireAdmin(c, services);
		if (denied) return denied;

		const body = await c.req.json();
		const inst = await services.instruction.create(c.get('teamId'), body);
		return c.json({ success: true, data: inst }, 201);
	});

	app.patch('/:id', async (c) => {
		const denied = await requireAdmin(c, services);
		if (denied) return denied;

		const body = await c.req.json();
		const inst = await services.instruction.update(c.req.param('id'), c.get('teamId'), body);
		return c.json({ success: true, data: inst });
	});

	app.delete('/:id', async (c) => {
		const denied = await requireAdmin(c, services);
		if (denied) return denied;

		await services.instruction.delete(c.req.param('id'), c.get('teamId'));
		return c.json({ success: true });
	});

	return app;
}
