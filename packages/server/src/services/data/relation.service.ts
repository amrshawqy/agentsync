import type { Database } from '@agentsync/db';
import { recordRelations, records } from '@agentsync/db';
import { and, eq, or, sql } from 'drizzle-orm';

export class RelationService {
	constructor(private db: Database) {}

	async link(
		params: {
			teamId: string;
			sourceRecordId: string;
			targetRecordId: string;
			relationType: string;
			fieldId?: string;
			createdBy?: string;
		},
		tx?: any,
	) {
		const executor = tx ?? this.db;

		// Enforce tenant ownership for both source and target records.
		const [source] = await executor
			.select({ id: records.id })
			.from(records)
			.where(
				and(
					eq(records.id, params.sourceRecordId),
					eq(records.teamId, params.teamId),
					sql`records.deleted_at IS NULL`,
				),
			);
		if (!source) {
			throw new Error('Source record not found');
		}

		const [target] = await executor
			.select({ id: records.id })
			.from(records)
			.where(
				and(
					eq(records.id, params.targetRecordId),
					eq(records.teamId, params.teamId),
					sql`records.deleted_at IS NULL`,
				),
			);
		if (!target) {
			throw new Error('Target record not found');
		}

		const [relation] = await executor
			.insert(recordRelations)
			.values({
				teamId: params.teamId,
				sourceRecordId: params.sourceRecordId,
				targetRecordId: params.targetRecordId,
				relationType: params.relationType,
				fieldId: params.fieldId,
				createdBy: params.createdBy,
			})
			.onConflictDoNothing()
			.returning();

		return relation;
	}

	async unlink(
		teamId: string,
		sourceRecordId: string,
		targetRecordId: string,
		relationType: string,
	): Promise<boolean> {
		const result = await this.db
			.delete(recordRelations)
			.where(
				and(
					eq(recordRelations.teamId, teamId),
					eq(recordRelations.sourceRecordId, sourceRecordId),
					eq(recordRelations.targetRecordId, targetRecordId),
					eq(recordRelations.relationType, relationType),
				),
			)
			.returning();

		return result.length > 0;
	}

	async getRelationsForRecord(recordId: string, teamId: string) {
		return this.db
			.select()
			.from(recordRelations)
			.where(
				and(
					eq(recordRelations.teamId, teamId),
					or(
						eq(recordRelations.sourceRecordId, recordId),
						eq(recordRelations.targetRecordId, recordId),
					),
				),
			);
	}

	async traverse(
		startRecordId: string,
		path: string[],
		teamId: string,
		maxDepth = 5,
	): Promise<any[]> {
		const [start] = await this.db
			.select({ id: records.id })
			.from(records)
			.where(
				and(
					eq(records.id, startRecordId),
					eq(records.teamId, teamId),
					sql`records.deleted_at IS NULL`,
				),
			);
		if (!start) {
			return [];
		}

		const results: any[] = [];
		let currentIds = [startRecordId];

		for (let i = 0; i < Math.min(path.length, maxDepth); i++) {
			const relationType = path[i];
			const nextIds: string[] = [];

			for (const id of currentIds) {
				const relations = await this.db
					.select()
					.from(recordRelations)
					.where(
						and(
							eq(recordRelations.sourceRecordId, id),
							eq(recordRelations.relationType, relationType),
							eq(recordRelations.teamId, teamId),
						),
					);

				for (const rel of relations) {
					nextIds.push(rel.targetRecordId);
					results.push({
						depth: i + 1,
						relationType,
						sourceRecordId: id,
						targetRecordId: rel.targetRecordId,
					});
				}
			}

			currentIds = nextIds;
			if (currentIds.length === 0) break;
		}

		return results;
	}
}
