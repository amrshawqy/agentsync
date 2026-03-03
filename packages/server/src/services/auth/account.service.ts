import { and, eq, sql } from 'drizzle-orm';
import type { Database } from '@agentsync/db';
import { accounts, users, teams, roles } from '@agentsync/db';

export class AccountService {
	constructor(private db: Database) {}

	async create() {
		const [account] = await this.db
			.insert(accounts)
			.values({})
			.returning();
		return account;
	}

	async getById(accountId: string) {
		const [account] = await this.db
			.select()
			.from(accounts)
			.where(eq(accounts.id, accountId));
		return account ?? null;
	}

	async getByPrimaryEmail(email: string) {
		const [account] = await this.db
			.select()
			.from(accounts)
			.where(eq(accounts.primaryEmail, email.toLowerCase()));
		return account ?? null;
	}

	async verifyEmail(accountId: string, email: string) {
		const [account] = await this.db
			.update(accounts)
			.set({
				primaryEmail: email.toLowerCase(),
				emailVerifiedAt: new Date(),
				limitsTier: 'verified',
				updatedAt: new Date(),
			})
			.where(eq(accounts.id, accountId))
			.returning();
		return account ?? null;
	}

	async listMemberships(accountId: string) {
		return this.db
			.select({
				userId: users.id,
				status: users.status,
				roleId: users.roleId,
				roleName: roles.name,
				teamId: teams.id,
				teamSlug: teams.slug,
				teamName: teams.name,
			})
			.from(users)
			.innerJoin(teams, eq(teams.id, users.teamId))
			.leftJoin(roles, eq(roles.id, users.roleId))
			.where(eq(users.accountId, accountId));
	}

	async countMemberships(accountId: string): Promise<number> {
		const [result] = await this.db
			.select({ count: sql<number>`count(*)` })
			.from(users)
			.where(
				and(
					eq(users.accountId, accountId),
					eq(users.status, 'active'),
				),
			);
		return Number(result?.count ?? 0);
	}

	async ensureAccountForMembership(userId: string): Promise<string | null> {
		const [membership] = await this.db
			.select()
			.from(users)
			.where(eq(users.id, userId));
		if (!membership) return null;
		if (membership.accountId) return membership.accountId;

		const [account] = await this.db
			.insert(accounts)
			.values({ primaryEmail: membership.email.toLowerCase() })
			.returning();

		await this.db
			.update(users)
			.set({ accountId: account.id })
			.where(eq(users.id, userId));

		return account.id;
	}
}
