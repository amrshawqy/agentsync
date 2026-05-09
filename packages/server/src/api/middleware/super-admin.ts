import type { Database } from '@agentsync/db';
import { accounts } from '@agentsync/db';
import { eq } from 'drizzle-orm';
import type { MiddlewareHandler } from 'hono';

/**
 * Gate that lets only platform super-admins through.
 * Must run after authMiddleware (so we have userId/accountId on the context).
 */
export function createSuperAdminMiddleware(db: Database): MiddlewareHandler {
	return async (c, next) => {
		const accountId = c.get('accountId') as string | undefined;
		if (!accountId) {
			return c.json({ error: { code: 'UNAUTHORIZED', message: 'Account context missing' } }, 401);
		}
		const [account] = await db.select().from(accounts).where(eq(accounts.id, accountId));
		if (!account || !account.isSuperAdmin) {
			return c.json({ error: { code: 'FORBIDDEN', message: 'Super-admin access required' } }, 403);
		}
		await next();
	};
}
