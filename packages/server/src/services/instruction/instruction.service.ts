import { eq, and } from 'drizzle-orm';
import type { Database } from '@agentsync/db';
import { instructions, workspaces } from '@agentsync/db';
import type { CreateInstruction, UpdateInstruction } from '@agentsync/types';
import type { CacheService } from '../cache/cache.service.js';
import {
	assembleTeamContext,
	assembleWorkspaceContext,
	assembleBusinessRules,
	assembleRoleGuidance,
} from './layers.js';

export class InstructionService {
	constructor(
		private db: Database,
		private cache: CacheService,
	) {}

	async assemble(teamId: string, roleId: string): Promise<string> {
		const cacheKey = `instructions:${teamId}:${roleId}`;
		const cached = await this.cache.get<string>(cacheKey);
		if (cached) return cached;

		const parts: string[] = [];

		// Layer 1: Team context
		const teamContext = await assembleTeamContext(this.db, teamId);
		if (teamContext) parts.push(teamContext);

		// Layer 2: Workspace context (all workspaces)
		const allWorkspaces = await this.db
			.select()
			.from(workspaces)
			.where(eq(workspaces.teamId, teamId));

		for (const ws of allWorkspaces) {
			const wsContext = await assembleWorkspaceContext(this.db, teamId, ws.id);
			if (wsContext) parts.push(wsContext);
		}

		// Layer 3: Business rules
		const rules = await assembleBusinessRules(this.db, teamId);
		if (rules) parts.push(rules);

		// Layer 4: Role guidance
		const guidance = await assembleRoleGuidance(this.db, teamId, roleId);
		if (guidance) parts.push(guidance);

		const assembled = parts.join('\n\n');
		await this.cache.set(cacheKey, assembled, 300);
		return assembled;
	}

	async create(teamId: string, input: CreateInstruction) {
		const [inst] = await this.db
			.insert(instructions)
			.values({
				teamId,
				scope: input.scope,
				scopeId: input.scopeId,
				instructionType: input.instructionType,
				content: input.content,
				priority: input.priority,
			})
			.returning();

		await this.invalidateCache(teamId);
		return inst;
	}

	async update(instructionId: string, teamId: string, input: UpdateInstruction) {
		const [updated] = await this.db
			.update(instructions)
			.set({
				...(input.content !== undefined && { content: input.content }),
				...(input.priority !== undefined && { priority: input.priority }),
				...(input.isActive !== undefined && { isActive: input.isActive }),
			})
			.where(and(eq(instructions.id, instructionId), eq(instructions.teamId, teamId)))
			.returning();

		if (!updated) throw new Error('Instruction not found');
		await this.invalidateCache(teamId);
		return updated;
	}

	async delete(instructionId: string, teamId: string): Promise<boolean> {
		const result = await this.db
			.delete(instructions)
			.where(and(eq(instructions.id, instructionId), eq(instructions.teamId, teamId)))
			.returning();

		await this.invalidateCache(teamId);
		return result.length > 0;
	}

	async list(teamId: string) {
		return this.db
			.select()
			.from(instructions)
			.where(and(eq(instructions.teamId, teamId), eq(instructions.isActive, true)))
			.orderBy(instructions.priority);
	}

	private async invalidateCache(teamId: string): Promise<void> {
		await this.cache.delPattern(`instructions:${teamId}:*`);
	}
}
