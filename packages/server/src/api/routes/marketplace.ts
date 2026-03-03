import { Hono } from 'hono';
import type { ServiceContainer } from '../../services/index.js';
import { authMiddleware } from '../middleware/auth.js';

export function createMarketplaceRoutes(services: ServiceContainer): Hono {
	const app = new Hono();

	// Search marketplace (public)
	app.get('/search', async (c) => {
		const query = c.req.query();
		const result = await services.marketplace.searchBlueprints(
			query.q,
			query.category,
			query.tags ? query.tags.split(',') : undefined,
			query.limit ? Number(query.limit) : 20,
			query.offset ? Number(query.offset) : 0,
		);
		return c.json({ success: true, ...result });
	});

	// List reviews for a blueprint (public)
	app.get('/blueprints/:id/reviews', async (c) => {
		const query = c.req.query();
		const result = await services.marketplace.listReviews(
			c.req.param('id'),
			query.limit ? Number(query.limit) : 20,
			query.offset ? Number(query.offset) : 0,
		);
		return c.json({ success: true, ...result });
	});

	// Submit a review (authenticated)
	app.post('/blueprints/:id/reviews', authMiddleware, async (c) => {
		const body = await c.req.json();
		const review = await services.marketplace.submitReview(
			c.get('teamId'),
			c.get('userId'),
			{
				blueprintId: c.req.param('id'),
				rating: body.rating,
				title: body.title,
				body: body.body,
			},
		);
		return c.json({ success: true, data: review }, 201);
	});

	return app;
}
