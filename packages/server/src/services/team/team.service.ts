import type { Database } from '@agentsync/db';
import { roles, teams } from '@agentsync/db';
import type { CreateTeam, UpdateTeam } from '@agentsync/types';
import { and, eq } from 'drizzle-orm';

export class TeamService {
	constructor(private db: Database) {}

	async create(input: CreateTeam) {
		const [team] = await this.db
			.insert(teams)
			.values({
				name: input.name,
				slug: input.slug,
				plan: input.plan ?? 'free',
				settings: input.settings ?? {},
			})
			.returning();

		// Create system roles
		await this.db.insert(roles).values([
			{
				teamId: team.id,
				name: 'admin',
				isSystem: true,
				permissions: {
					'*': { tables: { '*': { actions: ['create', 'read', 'update', 'delete'] } } },
				},
			},
			{ teamId: team.id, name: 'member', isSystem: true, permissions: {} },
			{ teamId: team.id, name: 'viewer', isSystem: true, permissions: {} },
		]);

		return team;
	}

	async getById(teamId: string) {
		const [team] = await this.db.select().from(teams).where(eq(teams.id, teamId));
		return team ?? null;
	}

	async getBySlug(slug: string) {
		const [team] = await this.db.select().from(teams).where(eq(teams.slug, slug));
		return team ?? null;
	}

	async update(teamId: string, input: UpdateTeam) {
		const [updated] = await this.db
			.update(teams)
			.set({ ...input, updatedAt: new Date() })
			.where(eq(teams.id, teamId))
			.returning();

		return updated ?? null;
	}

	async delete(teamId: string): Promise<boolean> {
		const result = await this.db.delete(teams).where(eq(teams.id, teamId)).returning();
		return result.length > 0;
	}

	async createRole(teamId: string, name: string, permissions: Record<string, unknown>) {
		const [role] = await this.db.insert(roles).values({ teamId, name, permissions }).returning();
		return role;
	}

	async getRoleByName(teamId: string, name: string) {
		const [role] = await this.db
			.select()
			.from(roles)
			.where(and(eq(roles.teamId, teamId), eq(roles.name, name)));
		return role ?? null;
	}

	async getRoleById(roleId: string) {
		const [role] = await this.db.select().from(roles).where(eq(roles.id, roleId));
		return role ?? null;
	}

	async updateRoleFieldAccess(
		roleId: string,
		workspace: string,
		table: string,
		fieldAccess: {
			hidden?: string[];
			readOnly?: string[];
		},
	) {
		const [role] = await this.db.select().from(roles).where(eq(roles.id, roleId));
		if (!role) throw new Error('Role not found');

		const perms = (role.permissions ?? {}) as Record<string, any>;
		if (!perms[workspace]) perms[workspace] = { tables: {} };
		if (!perms[workspace].tables) perms[workspace].tables = {};
		if (!perms[workspace].tables[table]) perms[workspace].tables[table] = { actions: ['read'] };

		perms[workspace].tables[table].field_access = {
			hidden: fieldAccess.hidden ?? [],
			read_only: fieldAccess.readOnly ?? [],
		};

		const [updated] = await this.db
			.update(roles)
			.set({ permissions: perms })
			.where(eq(roles.id, roleId))
			.returning();

		return updated;
	}
}
