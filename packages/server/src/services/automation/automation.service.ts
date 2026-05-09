import type { Database } from '@agentsync/db';
import { automations } from '@agentsync/db';
import { and, eq } from 'drizzle-orm';

export class AutomationService {
	constructor(private db: Database) {}

	async create(
		teamId: string,
		userId: string,
		input: {
			name: string;
			workspaceId?: string;
			description?: string;
			trigger: Record<string, unknown>;
			actions: Record<string, unknown>[];
		},
	) {
		const [automation] = await this.db
			.insert(automations)
			.values({
				teamId,
				workspaceId: input.workspaceId,
				name: input.name,
				description: input.description,
				trigger: input.trigger,
				actions: input.actions,
				createdBy: userId,
			})
			.returning();

		return automation;
	}

	async list(teamId: string, workspaceId?: string) {
		const conditions = [eq(automations.teamId, teamId)];
		if (workspaceId) {
			conditions.push(eq(automations.workspaceId, workspaceId));
		}
		return this.db
			.select()
			.from(automations)
			.where(and(...conditions));
	}

	async toggle(automationId: string, teamId: string, active: boolean) {
		const [updated] = await this.db
			.update(automations)
			.set({ isActive: active, updatedAt: new Date() })
			.where(and(eq(automations.id, automationId), eq(automations.teamId, teamId)))
			.returning();

		if (!updated) throw new Error('Automation not found');
		return updated;
	}

	async getById(automationId: string, teamId: string) {
		const [automation] = await this.db
			.select()
			.from(automations)
			.where(and(eq(automations.id, automationId), eq(automations.teamId, teamId)));
		return automation ?? null;
	}
}
