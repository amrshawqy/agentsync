import type { AgentKitFormat } from '@agentsync/types';
import { Hono } from 'hono';
import type { ServiceContainer } from '../../services/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { getRequestContext, requireAdmin } from '../middleware/route-authz.js';

export function createAgentKitRoutes(services: ServiceContainer): Hono {
	const app = new Hono();

	app.use('/*', authMiddleware);

	app.get('/', async (c) => {
		const format = (c.req.query('format') ?? 'claude-code') as AgentKitFormat;
		const ctx = getRequestContext(c);
		const userId = c.req.query('userId') ?? ctx.userId;
		if (userId !== ctx.userId) {
			const denied = await requireAdmin(c, services);
			if (denied) return denied;
		}
		const result = await services.agentKit.generate(ctx.teamId, userId, format);
		return c.json({ success: true, data: result });
	});

	app.get('/download', async (c) => {
		const format = (c.req.query('format') ?? 'claude-code') as AgentKitFormat;
		const ctx = getRequestContext(c);
		const userId = c.req.query('userId') ?? ctx.userId;
		if (userId !== ctx.userId) {
			const denied = await requireAdmin(c, services);
			if (denied) return denied;
		}
		const zip = await services.agentKit.generateZip(ctx.teamId, userId, format);

		return new Response(zip, {
			headers: {
				'Content-Type': 'application/zip',
				'Content-Disposition': `attachment; filename="agent-kit-${format}.zip"`,
			},
		});
	});

	app.get('/stale', async (c) => {
		const format = (c.req.query('format') ?? 'claude-code') as AgentKitFormat;
		const ctx = getRequestContext(c);
		const userId = c.req.query('userId') ?? ctx.userId;
		if (userId !== ctx.userId) {
			const denied = await requireAdmin(c, services);
			if (denied) return denied;
		}
		const stale = await services.agentKit.isStale(ctx.teamId, userId, format);
		return c.json({ success: true, data: { stale } });
	});

	return app;
}
