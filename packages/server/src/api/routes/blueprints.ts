import { Hono } from 'hono';
import type { ServiceContainer } from '../../services/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/route-authz.js';

export function createBlueprintRoutes(services: ServiceContainer): Hono {
	const app = new Hono();

	app.use('/*', authMiddleware);

	app.get('/', async (c) => {
		const builtin = await services.blueprint.listBuiltin();
		const published = await services.blueprint.listPublished();
		const all = [...builtin, ...published];
		const unique = Array.from(new Map(all.map((b) => [b.id, b])).values());
		return c.json({ success: true, data: unique });
	});

	app.post('/draft-from-description', async (c) => {
		const denied = await requireAdmin(c, services);
		if (denied) return denied;

		if (!services.blueprintDraft.isConfigured) {
			return c.json(
				{
					error: {
						code: 'BLUEPRINT_DRAFT_DISABLED',
						message: 'ANTHROPIC_API_KEY is not set on this server',
					},
				},
				404,
			);
		}
		const body = await c.req.json().catch(() => ({}));
		const description = String(body.description ?? '').trim();
		try {
			const draft = await services.blueprintDraft.draftFromDescription(description);
			return c.json({ success: true, data: draft });
		} catch (err) {
			return c.json({ error: { code: 'BLUEPRINT_DRAFT_FAILED', message: String(err) } }, 400);
		}
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
