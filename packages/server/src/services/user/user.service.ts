import type { Database } from '@agentsync/db';
import { roles, users } from '@agentsync/db';
import type { CreateUser, UpdateUser } from '@agentsync/types';
import { and, eq } from 'drizzle-orm';

export class UserService {
	constructor(private db: Database) {}

	async create(teamId: string, input: CreateUser) {
		const [user] = await this.db
			.insert(users)
			.values({
				teamId,
				accountId: input.accountId,
				email: input.email,
				name: input.name,
				roleId: input.roleId,
				agentId: input.agentId,
				status: 'invited',
			})
			.returning();

		return user;
	}

	async getById(userId: string) {
		const [user] = await this.db.select().from(users).where(eq(users.id, userId));
		return user ?? null;
	}

	async getByEmail(teamId: string, email: string) {
		const [user] = await this.db
			.select()
			.from(users)
			.where(and(eq(users.teamId, teamId), eq(users.email, email)));
		return user ?? null;
	}

	async listByTeam(teamId: string) {
		return this.db.select().from(users).where(eq(users.teamId, teamId));
	}

	async listByAccount(accountId: string) {
		return this.db.select().from(users).where(eq(users.accountId, accountId));
	}

	async getByAccountAndTeam(accountId: string, teamId: string) {
		const [user] = await this.db
			.select()
			.from(users)
			.where(and(eq(users.accountId, accountId), eq(users.teamId, teamId)));
		return user ?? null;
	}

	async update(userId: string, input: UpdateUser) {
		const [updated] = await this.db
			.update(users)
			.set(input)
			.where(eq(users.id, userId))
			.returning();

		return updated ?? null;
	}

	async delete(userId: string): Promise<boolean> {
		const result = await this.db.delete(users).where(eq(users.id, userId)).returning();
		return result.length > 0;
	}

	async updateLastConnected(userId: string): Promise<void> {
		await this.db.update(users).set({ lastConnectedAt: new Date() }).where(eq(users.id, userId));
	}

	async getRolesForTeam(teamId: string) {
		return this.db.select().from(roles).where(eq(roles.teamId, teamId));
	}
}
