import type { Database } from '@agentsync/db';
import { accounts, agents, auditLog, records, teams, users } from '@agentsync/db';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import type { ServiceContainer } from '../../services/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { createSuperAdminMiddleware } from '../middleware/super-admin.js';

export function createAdminRoutes(services: ServiceContainer, db: Database): Hono {
	const app = new Hono();

	app.use('/*', authMiddleware);
	app.use('/*', createSuperAdminMiddleware(db));

	app.get('/diagnostics', async (c) => {
		const dbCheck = await db
			.execute(sql`SELECT 1 as ok`)
			.then(() => ({ ok: true }))
			.catch((err) => ({ ok: false, detail: String(err) }));

		const cacheCheck = await services.cache
			.get<unknown>('agentsync:health')
			.then(() => ({ ok: true }))
			.catch((err) => ({ ok: false, detail: String(err) }));

		const emailCheck = await services.email.healthCheck();

		const oidcCheck = services.oidc.isConfigured
			? { ok: true, configured: true }
			: { ok: true, configured: false };

		const blueprintDraftCheck = {
			ok: true,
			configured: services.blueprintDraft.isConfigured,
		};

		return c.json({
			success: true,
			data: {
				db: dbCheck,
				cache: cacheCheck,
				email: { ...emailCheck, provider: services.email.providerName },
				oidc: oidcCheck,
				anthropic: blueprintDraftCheck,
			},
		});
	});

	app.get('/metrics', async (_c) => {
		const [accountsCount] = await db.select({ count: sql<number>`count(*)` }).from(accounts);
		const [teamsCount] = await db.select({ count: sql<number>`count(*)` }).from(teams);
		const [usersCount] = await db.select({ count: sql<number>`count(*)` }).from(users);
		const [agentsCount] = await db.select({ count: sql<number>`count(*)` }).from(agents);
		const [recordsCount] = await db.select({ count: sql<number>`count(*)` }).from(records);
		const [auditCount] = await db.select({ count: sql<number>`count(*)` }).from(auditLog);

		return _c.json({
			success: true,
			data: {
				accounts: Number(accountsCount?.count ?? 0),
				teams: Number(teamsCount?.count ?? 0),
				users: Number(usersCount?.count ?? 0),
				agents: Number(agentsCount?.count ?? 0),
				records: Number(recordsCount?.count ?? 0),
				auditEvents: Number(auditCount?.count ?? 0),
			},
		});
	});

	app.get('/teams', async (c) => {
		const rows = await db
			.select({
				id: teams.id,
				slug: teams.slug,
				name: teams.name,
				createdAt: teams.createdAt,
			})
			.from(teams)
			.orderBy(sql`${teams.createdAt} DESC`)
			.limit(200);
		return c.json({ success: true, data: rows });
	});

	return app;
}
