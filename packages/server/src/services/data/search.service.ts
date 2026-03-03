import { sql, eq, and } from 'drizzle-orm';
import type { Database } from '@agentsync/db';
import { records, recordIndexes } from '@agentsync/db';

export class SearchService {
	constructor(private db: Database) {}

	async search(params: {
		teamId: string;
		tableId: string;
		query: string;
		limit?: number;
		offset?: number;
		threshold?: number;
	}) {
		const { teamId, tableId, query, limit = 20, offset = 0, threshold = 0.3 } = params;

		// Use pg_trgm similarity operator for fuzzy matching
		const results = await this.db
			.select({
				recordId: recordIndexes.recordId,
				score: sql<number>`max(similarity(${recordIndexes.textValue}, ${query}))`.as('score'),
			})
			.from(recordIndexes)
			.where(
				and(
					eq(recordIndexes.teamId, teamId),
					eq(recordIndexes.tableId, tableId),
					sql`${recordIndexes.textValue} % ${query}`,
					sql`similarity(${recordIndexes.textValue}, ${query}) >= ${threshold}`,
				),
			)
			.groupBy(recordIndexes.recordId)
			.orderBy(sql`score DESC`)
			.limit(limit)
			.offset(offset);

		return results.map((r) => r.recordId);
	}

	async fullTextSearch(params: {
		teamId: string;
		tableId: string;
		query: string;
		limit?: number;
		offset?: number;
		threshold?: number;
	}) {
		const { teamId, tableId, query, limit = 20, offset = 0, threshold = 0.3 } = params;

		// Use pg_trgm similarity on JSONB data cast to text
		const results = await this.db
			.select()
			.from(records)
			.where(
				and(
					eq(records.teamId, teamId),
					eq(records.tableId, tableId),
					sql`records.deleted_at IS NULL`,
					sql`similarity(records.data::text, ${query}) >= ${threshold}`,
				),
			)
			.orderBy(sql`similarity(records.data::text, ${query}) DESC`)
			.limit(limit)
			.offset(offset);

		return results;
	}
}
