import { Hono } from 'hono';
import type { ServiceContainer } from '../../services/index.js';
import { getConfig } from '../../config.js';

export function createHealthRoutes(services: ServiceContainer): Hono {
	const app = new Hono();
	const startTime = Date.now();

	app.get('/health', async (c) => {
		const config = getConfig();
		let dbStatus: 'ok' | 'down' = 'ok';
		let redisStatus: 'ok' | 'down' = 'ok';

		try {
			// Lightweight DB probe
			await services.auth.getOAuthClient('__health_check__');
		} catch {
			dbStatus = 'down';
		}

		try {
			await services.cache.set('health:check', true, 5);
		} catch {
			redisStatus = 'down';
		}

		const status = dbStatus === 'ok' && redisStatus === 'ok' ? 'ok' : 'degraded';

		return c.json({
			status,
			version: config.MCP_SERVER_VERSION,
			uptime: Math.floor((Date.now() - startTime) / 1000),
			services: {
				database: dbStatus,
				redis: redisStatus,
			},
		});
	});

	return app;
}
