import { Hono } from 'hono';
import type { SubscriptionPattern } from '../../services/event/matcher.js';
import type { ServiceContainer } from '../../services/index.js';
import { authMiddleware } from '../middleware/auth.js';

export function createEventRoutes(services: ServiceContainer): Hono {
	const app = new Hono();

	app.use('/*', authMiddleware);

	app.post('/subscriptions', async (c) => {
		const body = await c.req.json();
		const sub = await services.event.subscribe(c.get('teamId'), c.get('userId'), {
			...body,
			callbackType: body.callbackType ?? 'sse',
		});
		return c.json({ success: true, data: sub }, 201);
	});

	app.delete('/subscriptions/:id', async (c) => {
		await services.event.unsubscribe(c.req.param('id'), c.get('teamId'));
		return c.json({ success: true });
	});

	app.get('/subscriptions', async (c) => {
		const activeOnly = c.req.query('activeOnly') !== 'false';
		const subs = await services.event.listSubscriptions(
			c.get('teamId'),
			c.get('userId'),
			activeOnly,
		);
		return c.json({ success: true, data: subs });
	});

	// SSE stream (with Last-Event-ID replay support)
	app.get('/stream', async (c) => {
		const teamId = c.get('teamId');
		const userId = c.get('userId');
		const connectionId = crypto.randomUUID();
		const lastEventId = c.req.header('Last-Event-ID');

		const stream = new ReadableStream({
			async start(controller) {
				const subscriptions = await services.event.listSubscriptions(teamId, userId, true);
				const ssePatterns: SubscriptionPattern[] = subscriptions
					.filter((sub) => sub.callbackType === 'sse')
					.map((sub) => ({
						eventType: sub.eventType as any,
						workspaceId: sub.workspaceId ?? undefined,
						tableId: sub.tableId ?? undefined,
						fieldSlug: sub.fieldSlug ?? undefined,
						condition: (sub.condition as Record<string, unknown> | null) ?? undefined,
					}));

				// Replay missed events if reconnecting
				if (lastEventId) {
					await services.event.replay(lastEventId, teamId, controller, ssePatterns, {
						deliverAllWhenNoPatterns: false,
					});
				}

				services.sseManager.addConnection(connectionId, userId, teamId, ssePatterns, controller, {
					deliverAllWhenNoPatterns: false,
				});
				controller.enqueue(
					new TextEncoder().encode(
						`id: connect\ndata: {"connected":true,"connectionId":"${connectionId}"}\n\n`,
					),
				);
			},
			cancel() {
				services.sseManager.removeConnection(connectionId);
			},
		});

		return new Response(stream, {
			headers: {
				'Content-Type': 'text/event-stream',
				'Cache-Control': 'no-cache',
				Connection: 'keep-alive',
			},
		});
	});

	return app;
}
