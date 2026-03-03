import { createMiddleware } from 'hono/factory';
import { sql } from 'drizzle-orm';
import type { Database } from '@agentsync/db';

/**
 * Middleware that sets `app.current_team_id` on the Postgres session
 * so that RLS org_isolation policies can enforce tenant isolation.
 *
 * Must run AFTER auth middleware (which populates `teamId` on the context).
 */
export function createTeamContextMiddleware(db: Database) {
	return createMiddleware(async (c, next) => {
		const teamId: string | undefined = c.get('teamId');

		if (teamId) {
			await db.execute(
				sql`SELECT set_config('app.current_team_id', ${teamId}, false)`,
			);
		}

		try {
			await next();
		} finally {
			if (teamId) {
				await db.execute(sql.raw('RESET app.current_team_id'));
			}
		}
	});
}
