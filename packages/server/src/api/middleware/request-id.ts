import crypto from 'node:crypto';
import type { MiddlewareHandler } from 'hono';

const HEADER = 'X-Request-Id';

export function requestIdMiddleware(): MiddlewareHandler {
	return async (c, next) => {
		const incoming = c.req.header(HEADER);
		const id = incoming && incoming.length <= 128 ? incoming : crypto.randomUUID();
		c.set('requestId', id);
		c.header(HEADER, id);
		await next();
	};
}

export function getRequestId(c: { get: (k: string) => unknown }): string | undefined {
	const v = c.get('requestId');
	return typeof v === 'string' ? v : undefined;
}
