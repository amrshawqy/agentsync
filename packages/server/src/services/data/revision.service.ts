import type { Database } from '@agentsync/db';
import { recordRevisions } from '@agentsync/db';
import { and, desc, eq, sql } from 'drizzle-orm';

type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];
type DbOrTx = Database | Tx;

const RETENTION_DAYS = 7;

export type RevisionKind = 'create' | 'update' | 'delete' | 'revert';

export interface RecordRevisionRow {
	id: string;
	recordId: string;
	teamId: string;
	revisionKind: string;
	data: unknown;
	provenance: Record<string, unknown> | null;
	note: string | null;
	createdAt: Date;
	createdBy: string | null;
}

export class RevisionService {
	constructor(private db: Database) {}

	async record(
		client: DbOrTx,
		params: {
			recordId: string;
			teamId: string;
			revisionKind: RevisionKind;
			data: unknown;
			provenance: Record<string, unknown> | null;
			createdBy: string | null;
			note?: string;
		},
	) {
		await client.insert(recordRevisions).values({
			recordId: params.recordId,
			teamId: params.teamId,
			revisionKind: params.revisionKind,
			data: params.data,
			provenance: params.provenance ?? undefined,
			note: params.note ?? null,
			createdBy: params.createdBy,
		});
	}

	async list(params: {
		recordId: string;
		teamId: string;
		limit?: number;
		offset?: number;
	}): Promise<{ data: RecordRevisionRow[]; total: number; limit: number; offset: number }> {
		const limit = Math.min(Math.max(params.limit ?? 25, 1), 100);
		const offset = Math.max(params.offset ?? 0, 0);

		const rows = await this.db
			.select()
			.from(recordRevisions)
			.where(
				and(
					eq(recordRevisions.recordId, params.recordId),
					eq(recordRevisions.teamId, params.teamId),
				),
			)
			.orderBy(desc(recordRevisions.createdAt))
			.limit(limit)
			.offset(offset);

		const [count] = await this.db
			.select({ count: sql<number>`count(*)` })
			.from(recordRevisions)
			.where(
				and(
					eq(recordRevisions.recordId, params.recordId),
					eq(recordRevisions.teamId, params.teamId),
				),
			);

		return {
			data: rows as unknown as RecordRevisionRow[],
			total: Number(count?.count ?? 0),
			limit,
			offset,
		};
	}

	async getById(revisionId: string, teamId: string): Promise<RecordRevisionRow | null> {
		const [row] = await this.db
			.select()
			.from(recordRevisions)
			.where(and(eq(recordRevisions.id, revisionId), eq(recordRevisions.teamId, teamId)));
		return (row as unknown as RecordRevisionRow) ?? null;
	}

	/** Delete revisions older than RETENTION_DAYS. Safe to call from a daily job. */
	async garbageCollect(): Promise<number> {
		const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
		const result = await this.db
			.delete(recordRevisions)
			.where(sql`${recordRevisions.createdAt} < ${cutoff}`)
			.returning({ id: recordRevisions.id });
		return result.length;
	}

	get retentionDays() {
		return RETENTION_DAYS;
	}
}
