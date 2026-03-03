import { Hono } from 'hono';
import type { ServiceContainer } from '../../services/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/route-authz.js';

export function createBlueprintRoutes(services: ServiceContainer): Hono {
	const app = new Hono();

	app.use('/*', authMiddleware);

	app.get('/', async (c) => {
		const blueprints = await services.blueprint.listPublished();
		return c.json({ success: true, data: blueprints });
	});

	app.get('/builtin', async (c) => {
		const blueprints = await services.blueprint.listBuiltin();
		return c.json({ success: true, data: blueprints });
	});

	app.get('/:slug', async (c) => {
		const bp = await services.blueprint.getBySlug(c.req.param('slug'));
		if (!bp) return c.json({ error: { code: 'NOT_FOUND', message: 'Blueprint not found' } }, 404);
		return c.json({ success: true, data: bp });
	});

	app.post('/', async (c) => {
		const denied = await requireAdmin(c, services);
		if (denied) return denied;

		const body = await c.req.json();
		const bp = await services.blueprint.create(body, c.get('teamId'));
		return c.json({ success: true, data: bp }, 201);
	});

	app.post('/:slug/deploy', async (c) => {
		const denied = await requireAdmin(c, services);
		if (denied) return denied;

		const body = await c.req.json().catch(() => ({}));
		const workspace = await services.blueprint.deploy(c.get('teamId'), c.req.param('slug'), body);
		return c.json({ success: true, data: workspace }, 201);
	});

	app.post('/:slug/publish', async (c) => {
		const denied = await requireAdmin(c, services);
		if (denied) return denied;

		const bp = await services.blueprint.publish(c.req.param('slug'));
		return c.json({ success: true, data: bp });
	});

	app.post('/:slug/evolve', async (c) => {
		const denied = await requireAdmin(c, services);
		if (denied) return denied;

		const body = await c.req.json();
		const evolved = await services.blueprint.evolve(c.req.param('slug'), body);
		return c.json({ success: true, data: evolved }, 201);
	});

	return app;
}
