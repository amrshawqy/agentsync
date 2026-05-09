import type { Database } from '@agentsync/db';
import { records } from '@agentsync/db';
import type { SchemaField } from '@agentsync/types';
import { and, eq, sql } from 'drizzle-orm';
import type { RelationService } from './relation.service.js';

interface RollupConfig {
	sourceRelation: string;
	sourceField: string;
	aggregation: 'sum' | 'avg' | 'min' | 'max' | 'count' | 'concat';
}

/**
 * RollupEngine — resolves rollup fields by traversing relations and aggregating.
 * Computed on read (not stored). Only for single-record fetches to avoid N+1.
 */
export class RollupEngine {
	constructor(
		private db: Database,
		private relationService: RelationService,
	) {}

	/**
	 * Resolve all rollup fields for a single record.
	 */
	async resolveRollups(
		recordId: string,
		teamId: string,
		data: Record<string, unknown>,
		fields: SchemaField[],
	): Promise<Record<string, unknown>> {
		const result: Record<string, unknown> = {};
		const rollupFields = fields.filter((f) => f.fieldType === 'rollup' && (f as any).rollupConfig);

		if (rollupFields.length === 0) return result;

		// Get all relations for this record once
		const relations = await this.relationService.getRelationsForRecord(recordId, teamId);

		for (const field of rollupFields) {
			const config = (field as any).rollupConfig as RollupConfig;
			if (!config) continue;

			// Filter relations by the source relation type
			const matchingRelations = relations.filter((r) => r.relationType === config.sourceRelation);

			if (matchingRelations.length === 0) {
				result[field.slug] = config.aggregation === 'count' ? 0 : null;
				continue;
			}

			// Get related record IDs (both source and target sides)
			const relatedIds = matchingRelations.map((r) =>
				r.sourceRecordId === recordId ? r.targetRecordId : r.sourceRecordId,
			);

			// Fetch related records
			const relatedRecords = await this.db
				.select()
				.from(records)
				.where(
					and(
						sql`${records.id} = ANY(${relatedIds})`,
						eq(records.teamId, teamId),
						sql`${records.deletedAt} IS NULL`,
					),
				);

			// Extract values for the source field
			const values = relatedRecords
				.map((r) => (r.data as Record<string, unknown>)?.[config.sourceField])
				.filter((v) => v !== undefined && v !== null);

			result[field.slug] = this.aggregate(values, config.aggregation);
		}

		return result;
	}

	private aggregate(values: unknown[], aggregation: string): unknown {
		if (values.length === 0) {
			return aggregation === 'count' ? 0 : null;
		}

		switch (aggregation) {
			case 'count':
				return values.length;

			case 'sum': {
				const nums = values.map(Number).filter((n) => !Number.isNaN(n));
				return nums.reduce((a, b) => a + b, 0);
			}

			case 'avg': {
				const nums = values.map(Number).filter((n) => !Number.isNaN(n));
				if (nums.length === 0) return null;
				return nums.reduce((a, b) => a + b, 0) / nums.length;
			}

			case 'min': {
				const nums = values.map(Number).filter((n) => !Number.isNaN(n));
				if (nums.length === 0) return null;
				return Math.min(...nums);
			}

			case 'max': {
				const nums = values.map(Number).filter((n) => !Number.isNaN(n));
				if (nums.length === 0) return null;
				return Math.max(...nums);
			}

			case 'concat':
				return values.map(String).join(', ');

			default:
				return null;
		}
	}
}
