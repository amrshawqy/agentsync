import crypto from 'node:crypto';
import { eq, and } from 'drizzle-orm';
import type { Database } from '@agentsync/db';
import { agentKitGenerations } from '@agentsync/db';
import type { AgentKitFormat } from '@agentsync/types';

export class StalenessDetector {
	constructor(private db: Database) {}

	computeHash(data: unknown): string {
		return crypto
			.createHash('sha256')
			.update(JSON.stringify(data))
			.digest('hex');
	}

	async isStale(
		teamId: string,
		userId: string,
		format: AgentKitFormat,
		currentSchemaData: unknown,
	): Promise<boolean> {
		const [lastGen] = await this.db
			.select()
			.from(agentKitGenerations)
			.where(
				and(
					eq(agentKitGenerations.teamId, teamId),
					eq(agentKitGenerations.userId, userId),
					eq(agentKitGenerations.format, format),
				),
			);

		if (!lastGen) return true;

		const currentHash = this.computeHash(currentSchemaData);
		return lastGen.schemaVersionHash !== currentHash;
	}

	async recordGeneration(
		teamId: string,
		userId: string,
		format: AgentKitFormat,
		schemaData: unknown,
	): Promise<void> {
		const hash = this.computeHash(schemaData);

		await this.db
			.insert(agentKitGenerations)
			.values({
				teamId,
				userId,
				format,
				schemaVersionHash: hash,
			})
			.onConflictDoUpdate({
				target: [
					agentKitGenerations.teamId,
					agentKitGenerations.userId,
					agentKitGenerations.format,
				],
				set: {
					schemaVersionHash: hash,
					generatedAt: new Date(),
				},
			});
	}
}
