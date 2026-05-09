import { createMiddleware } from 'hono/factory';
import { type JwtPayload, verifyJwt } from '../../services/auth/jwt.js';

declare module 'hono' {
	interface ContextVariableMap {
		jwtPayload: JwtPayload;
		teamId: string;
		userId: string;
		roleId: string;
		accountId?: string;
		agentId?: string;
		limitsTier?: 'unverified' | 'verified';
	}
}

export const authMiddleware = createMiddleware(async (c, next) => {
	const authHeader = c.req.header('Authorization');
	if (!authHeader?.startsWith('Bearer ')) {
		return c.json({ error: { code: 'UNAUTHORIZED', message: 'Missing Bearer token' } }, 401);
	}

	const token = authHeader.slice(7);

	try {
		const payload = await verifyJwt(token);
		c.set('jwtPayload', payload);
		c.set('teamId', (payload.team as string) ?? '');
		c.set('userId', payload.sub);
		c.set('roleId', (payload.role as string) ?? '');
		if (payload.account_id) c.set('accountId', payload.account_id as string);
		if (payload.agent_id) c.set('agentId', payload.agent_id as string);
		if (payload.limits_tier) c.set('limitsTier', payload.limits_tier as 'unverified' | 'verified');
		await next();
	} catch (err) {
		return c.json({ error: { code: 'INVALID_TOKEN', message: 'Invalid or expired token' } }, 401);
	}
});
