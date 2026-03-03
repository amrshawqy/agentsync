import { createMiddleware } from 'hono/factory';
import type { CacheService } from '../../services/cache/cache.service.js';

export function createRateLimitMiddleware(cache: CacheService, windowSeconds: number = 60, maxRequests: number = 100) {
	return createMiddleware(async (c, next) => {
		const identifier = c.get('userId') ?? c.req.header('x-forwarded-for') ?? 'anonymous';
		const key = `ratelimit:${identifier}:${Math.floor(Date.now() / (windowSeconds * 1000))}`;

		const count = await cache.incr(key, windowSeconds);

		c.header('X-RateLimit-Limit', String(maxRequests));
		c.header('X-RateLimit-Remaining', String(Math.max(0, maxRequests - count)));

		if (count > maxRequests) {
			return c.json(
				{ error: { code: 'RATE_LIMITED', message: 'Too many requests' } },
				429,
			);
		}

		await next();
	});
}
