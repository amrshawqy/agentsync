import type { Database } from '@agentsync/db';
import { recordIndexes, records } from '@agentsync/db';
import type { CreateRecord, QueryRecords, UpdateRecord } from '@agentsync/types';
import type { RequestContext } from '@agentsync/types';
import type { PermissionEvaluation } from '@agentsync/types';
import { and, eq, sql } from 'drizzle-orm';
import type { AuditService } from '../audit/audit.service.js';
import type { PermissionService } from '../auth/permission.service.js';
import type { EventService } from '../event/event.service.js';
import type { ConstraintService } from '../schema/constraint.service.js';
import type { SchemaService } from '../schema/schema.service.js';
import type { FormulaEngine } from './formula-engine.js';
import type { IndexService } from './index.service.js';
import type { ProvenanceService } from './provenance.service.js';
import type { RelationService } from './relation.service.js';
import type { RevisionService } from './revision.service.js';
import type { RollupEngine } from './rollup-engine.js';
import type { SearchService } from './search.service.js';

export class DataService {
	constructor(
		private db: Database,
		private provenanceService: ProvenanceService,
		private indexService: IndexService,
		private relationService: RelationService,
		private searchService: SearchService,
		private constraintService: ConstraintService,
		private permissionService: PermissionService,
		private schemaService: SchemaService,
		private eventService?: EventService,
		private auditService?: AuditService,
		private formulaEngine?: FormulaEngine,
		private rollupEngine?: RollupEngine,
		private revisionService?: RevisionService,
	) {}

	private async checkPermission(
		ctx: RequestContext,
		tableId: string,
		action: 'create' | 'read' | 'update' | 'delete',
		opts?: { recordOwnerId?: string; recordData?: Record<string, unknown> },
	): Promise<PermissionEvaluation> {
		const table = await this.schemaService.getTableById(tableId);
		if (!table) throw new Error('Table not found');

		const ws = await this.schemaService.getWorkspaceById(table.workspaceId);
		const result = await this.permissionService.evaluate({
			teamId: ctx.teamId,
			userId: ctx.userId,
			roleId: ctx.roleId,
			workspace: ws?.slug ?? '',
			table: table.slug,
			action,
			recordOwnerId: opts?.recordOwnerId,
			recordData: opts?.recordData,
		});

		if (!result.allowed) {
			throw new Error(`Permission denied: ${result.reason ?? 'Insufficient permissions'}`);
		}
		return result;
	}

	private filterHiddenFields<T extends { data: unknown; provenance: unknown }>(
		recordOrRecords: T | T[],
		fieldAccess?: { hidden: string[]; readOnly: string[] },
	): T | T[] {
		if (!fieldAccess?.hidden?.length) return recordOrRecords;

		const hidden = new Set(fieldAccess.hidden);
		const strip = (rec: T): T => {
			const data = { ...(rec.data as Record<string, unknown>) };
			const provenance = { ...(rec.provenance as Record<string, unknown>) };
			for (const field of hidden) {
				delete data[field];
				delete provenance[field];
			}
			return { ...rec, data, provenance };
		};

		if (Array.isArray(recordOrRecords)) {
			return recordOrRecords.map(strip);
		}
		return strip(recordOrRecords);
	}

	private async resolveEventScope(tableId: string): Promise<{
		tableId: string;
		table?: string;
		workspaceId?: string;
		workspace?: string;
	}> {
		const scope: {
			tableId: string;
			table?: string;
			workspaceId?: string;
			workspace?: string;
		} = { tableId };

		const table = await this.schemaService.getTableById(tableId);
		if (!table) return scope;

		scope.table = table.slug;
		scope.workspaceId = table.workspaceId;

		if (table.workspaceId) {
			const workspace = await this.schemaService.getWorkspaceById(table.workspaceId);
			if (workspace?.slug) scope.workspace = workspace.slug;
		}

		return scope;
	}

	async createRecord(ctx: RequestContext, input: CreateRecord & { confidence?: number }) {
		// Permission check
		const permResult = await this.checkPermission(ctx, input.tableId, 'create');

		const table = await this.schemaService.getTableById(input.tableId);
		if (!table) throw new Error('Table not found');
		const workspace = await this.schemaService.getWorkspaceById(table.workspaceId);
		const eventScope = {
			tableId: input.tableId,
			table: table.slug,
			workspaceId: table.workspaceId,
			workspace: workspace?.slug ?? undefined,
		};

		// Validate constraints
		const violations = await this.constraintService.validate(input.tableId, input.data);
		if (violations.length > 0) {
			throw new Error(`Validation failed: ${violations.map((v) => v.message).join('; ')}`);
		}

		// Build provenance (with optional confidence)
		const provenance = this.provenanceService.buildProvenance(
			input.data,
			ctx.agentId ?? ctx.userId,
			input.confidence,
		);

		// Wrap in transaction
		const record = await this.db.transaction(async (tx) => {
			// Insert record
			const [rec] = await tx
				.insert(records)
				.values({
					teamId: ctx.teamId,
					tableId: input.tableId,
					data: input.data,
					provenance,
					createdBy: ctx.userId,
					updatedBy: ctx.userId,
				})
				.returning();

			// Update indexes
			await this.indexService.updateIndexes(rec.id, ctx.teamId, input.tableId, input.data, tx);

			if (this.revisionService) {
				await this.revisionService.record(tx, {
					recordId: rec.id,
					teamId: ctx.teamId,
					revisionKind: 'create',
					data: input.data,
					provenance,
					createdBy: ctx.userId || null,
				});
			}

			// Create relations if specified
			if (input.links) {
				for (const link of input.links) {
					await this.relationService.link(
						{
							teamId: ctx.teamId,
							sourceRecordId: rec.id,
							targetRecordId: link.targetRecordId,
							relationType: link.relationType,
							createdBy: ctx.userId,
						},
						tx,
					);
				}
			}

			return rec;
		});

		// Emit event + audit (outside transaction)
		if (this.eventService) {
			await this.eventService.emit({
				eventType: 'record.created',
				teamId: ctx.teamId,
				...eventScope,
				recordId: record.id,
				data: input.data,
			});
		}
		if (this.auditService) {
			await this.auditService.log(ctx, {
				action: 'create',
				resourceType: 'record',
				resourceId: record.id,
				tableId: input.tableId,
				metadata: { data: input.data },
				provenance,
			});
		}

		return this.filterHiddenFields(record, permResult.fieldAccess) as typeof record;
	}

	async getRecord(ctx: RequestContext, recordId: string) {
		const [record] = await this.db
			.select()
			.from(records)
			.where(
				and(
					eq(records.id, recordId),
					eq(records.teamId, ctx.teamId),
					sql`records.deleted_at IS NULL`,
				),
			);

		if (!record) return null;

		// Permission check + field filtering
		const permResult = await this.checkPermission(ctx, record.tableId, 'read');

		const relations = await this.relationService.getRelationsForRecord(recordId, ctx.teamId);

		// Resolve computed fields (formulas + rollups)
		let data = record.data as Record<string, unknown>;
		const fields = await this.schemaService.getFieldsForTable(record.tableId);
		if (this.formulaEngine) {
			const computed = this.formulaEngine.resolveFormulas(data, fields as any);
			data = { ...data, ...computed };
		}
		if (this.rollupEngine) {
			const rollups = await this.rollupEngine.resolveRollups(
				recordId,
				record.teamId,
				data,
				fields as any,
			);
			data = { ...data, ...rollups };
		}

		const full = { ...record, data, relations };

		return this.filterHiddenFields(full, permResult.fieldAccess) as typeof full;
	}

	async updateRecord(
		ctx: RequestContext,
		recordId: string,
		input: UpdateRecord & { confidence?: number },
	) {
		// Get existing record
		const [existing] = await this.db
			.select()
			.from(records)
			.where(
				and(
					eq(records.id, recordId),
					eq(records.teamId, ctx.teamId),
					sql`records.deleted_at IS NULL`,
				),
			);

		if (!existing) throw new Error('Record not found');

		// Permission check with record data for filter evaluation
		const existingData = existing.data as Record<string, unknown>;
		const permResult = await this.checkPermission(ctx, existing.tableId, 'update', {
			recordOwnerId: existing.createdBy ?? undefined,
			recordData: existingData,
		});

		// Validate constraints
		const violations = await this.constraintService.validate(
			existing.tableId,
			input.data,
			existingData,
		);
		if (violations.length > 0) {
			throw new Error(`Validation failed: ${violations.map((v) => v.message).join('; ')}`);
		}

		// Merge data and provenance (with optional confidence)
		const mergedData = { ...existingData, ...input.data };
		const mergedProvenance = this.provenanceService.mergeProvenance(
			existing.provenance as Record<string, any>,
			input.data,
			ctx.agentId ?? ctx.userId,
			input.confidence,
		);

		// Wrap in transaction
		const updated = await this.db.transaction(async (tx) => {
			const [rec] = await tx
				.update(records)
				.set({
					data: mergedData,
					provenance: mergedProvenance,
					updatedBy: ctx.userId,
					updatedAt: new Date(),
				})
				.where(eq(records.id, recordId))
				.returning();

			// Update indexes
			await this.indexService.updateIndexes(recordId, ctx.teamId, existing.tableId, mergedData, tx);

			if (this.revisionService) {
				await this.revisionService.record(tx, {
					recordId,
					teamId: ctx.teamId,
					revisionKind: 'update',
					data: mergedData,
					provenance: mergedProvenance,
					createdBy: ctx.userId || null,
				});
			}

			return rec;
		});

		// Emit event + audit
		const eventScope = await this.resolveEventScope(existing.tableId);
		if (this.eventService) {
			await this.eventService.emit({
				eventType: 'record.updated',
				teamId: ctx.teamId,
				...eventScope,
				recordId: updated.id,
				data: input.data,
			});
		}
		if (this.auditService) {
			await this.auditService.log(ctx, {
				action: 'update',
				resourceType: 'record',
				resourceId: recordId,
				tableId: existing.tableId,
				metadata: { updates: input.data },
			});
		}

		return this.filterHiddenFields(updated, permResult.fieldAccess) as typeof updated;
	}

	async revertRecord(ctx: RequestContext, recordId: string, revisionId: string) {
		if (!this.revisionService) {
			throw new Error('Revisions are not enabled on this server');
		}
		const [existing] = await this.db
			.select()
			.from(records)
			.where(
				and(
					eq(records.id, recordId),
					eq(records.teamId, ctx.teamId),
					sql`records.deleted_at IS NULL`,
				),
			);
		if (!existing) throw new Error('Record not found');

		const revision = await this.revisionService.getById(revisionId, ctx.teamId);
		if (!revision || revision.recordId !== recordId) {
			throw new Error('Revision not found');
		}

		const permResult = await this.checkPermission(ctx, existing.tableId, 'update', {
			recordOwnerId: existing.createdBy ?? undefined,
			recordData: existing.data as Record<string, unknown>,
		});

		const restoredData = revision.data as Record<string, unknown>;
		const restoredProvenance = (revision.provenance ?? {}) as Record<string, unknown>;

		const updated = await this.db.transaction(async (tx) => {
			const [rec] = await tx
				.update(records)
				.set({
					data: restoredData,
					provenance: restoredProvenance,
					updatedBy: ctx.userId,
					updatedAt: new Date(),
				})
				.where(eq(records.id, recordId))
				.returning();

			await this.indexService.updateIndexes(
				recordId,
				ctx.teamId,
				existing.tableId,
				restoredData,
				tx,
			);

			await this.revisionService?.record(tx, {
				recordId,
				teamId: ctx.teamId,
				revisionKind: 'revert',
				data: restoredData,
				provenance: restoredProvenance,
				createdBy: ctx.userId || null,
				note: `revert to revision ${revisionId}`,
			});

			return rec;
		});

		const eventScope = await this.resolveEventScope(existing.tableId);
		if (this.eventService) {
			await this.eventService.emit({
				eventType: 'record.updated',
				teamId: ctx.teamId,
				...eventScope,
				recordId,
				data: restoredData,
			});
		}
		if (this.auditService) {
			await this.auditService.log(ctx, {
				action: 'update',
				resourceType: 'record',
				resourceId: recordId,
				tableId: existing.tableId,
				metadata: { revertedToRevisionId: revisionId },
			});
		}

		return this.filterHiddenFields(updated, permResult.fieldAccess) as typeof updated;
	}

	async deleteRecord(ctx: RequestContext, recordId: string, reason?: string) {
		const [existing] = await this.db
			.select()
			.from(records)
			.where(
				and(
					eq(records.id, recordId),
					eq(records.teamId, ctx.teamId),
					sql`records.deleted_at IS NULL`,
				),
			);

		if (!existing) throw new Error('Record not found');

		// Permission check with record data for filter evaluation
		await this.checkPermission(ctx, existing.tableId, 'delete', {
			recordOwnerId: existing.createdBy ?? undefined,
			recordData: existing.data as Record<string, unknown>,
		});

		const [deleted] = await this.db
			.update(records)
			.set({
				deletedAt: new Date(),
				updatedBy: ctx.userId,
				updatedAt: new Date(),
			})
			.where(eq(records.id, recordId))
			.returning();

		// Clean up indexes
		await this.indexService.deleteIndexes(recordId);

		if (this.revisionService) {
			await this.revisionService.record(this.db, {
				recordId,
				teamId: ctx.teamId,
				revisionKind: 'delete',
				data: existing.data,
				provenance: existing.provenance as Record<string, unknown> | null,
				createdBy: ctx.userId || null,
				note: reason,
			});
		}

		// Emit event + audit
		const eventScope = await this.resolveEventScope(existing.tableId);
		if (this.eventService) {
			await this.eventService.emit({
				eventType: 'record.deleted',
				teamId: ctx.teamId,
				...eventScope,
				recordId,
				data: {},
			});
		}
		if (this.auditService) {
			await this.auditService.log(ctx, {
				action: 'delete',
				resourceType: 'record',
				resourceId: recordId,
				tableId: existing.tableId,
				reason,
			});
		}

		return deleted;
	}

	async queryRecords(ctx: RequestContext, input: QueryRecords) {
		// Permission check + field filtering
		const permResult = await this.checkPermission(ctx, input.tableId, 'read');

		// Build base conditions
		const conditions = [
			eq(records.teamId, ctx.teamId),
			eq(records.tableId, input.tableId),
			sql`records.deleted_at IS NULL`,
		];

		// Apply filters via JOINs on record_indexes for proper pagination
		if (input.filters && Object.keys(input.filters).length > 0) {
			const fields = await this.schemaService.getFieldsForTable(input.tableId);
			const fieldMap = new Map(fields.map((f) => [f.slug, f]));

			for (const [key, value] of Object.entries(input.filters)) {
				const field = fieldMap.get(key);
				if (field && value !== undefined) {
					const subquery = sql`EXISTS (
						SELECT 1 FROM record_indexes ri
						WHERE ri.record_id = records.id
						AND ri.field_id = ${field.id}
						AND ri.text_value = ${String(value)}
					)`;
					conditions.push(subquery);
				}
			}
		}

		// Search filter
		if (input.search) {
			const matchingIds = await this.searchService.search({
				teamId: ctx.teamId,
				tableId: input.tableId,
				query: input.search,
			});
			if (matchingIds.length === 0) {
				return {
					data: [],
					total: 0,
					limit: input.limit ?? 50,
					offset: input.offset ?? 0,
					hasMore: false,
				};
			}
			conditions.push(sql`records.id = ANY(${matchingIds})`);
		}

		const whereClause = and(...conditions);

		// Count total matching
		const [countResult] = await this.db
			.select({ count: sql<number>`count(*)` })
			.from(records)
			.where(whereClause);

		const total = Number(countResult?.count ?? 0);
		const limit = input.limit ?? 50;
		const offset = input.offset ?? 0;

		// Build query with sort
		let query = this.db.select().from(records).where(whereClause);

		// Apply sort parameter
		if (input.sort?.length) {
			for (const s of input.sort) {
				query = query.orderBy(
					s.direction === 'desc'
						? sql`${records.data}->>${s.field} DESC`
						: sql`${records.data}->>${s.field} ASC`,
				) as any;
			}
		} else {
			query = query.orderBy(records.createdAt) as any;
		}

		// Fetch page
		const results = await (query as any).limit(limit).offset(offset);

		// Resolve formula fields for query results (rollups skipped to avoid N+1)
		let processedResults = results;
		if (this.formulaEngine) {
			const fields = await this.schemaService.getFieldsForTable(input.tableId);
			processedResults = results.map((rec: any) => {
				const computed = this.formulaEngine?.resolveFormulas(
					rec.data as Record<string, unknown>,
					fields as any,
				);
				return { ...rec, data: { ...(rec.data as Record<string, unknown>), ...computed } };
			});
		}

		// Filter hidden fields from results
		const filteredData = this.filterHiddenFields(
			processedResults,
			permResult.fieldAccess,
		) as typeof results;

		return {
			data: filteredData,
			total,
			limit,
			offset,
			hasMore: offset + results.length < total,
		};
	}

	async verifyField(
		ctx: RequestContext,
		recordId: string,
		field: string,
		method: string,
		outcome: 'valid' | 'invalid' | 'unconfirmed',
	) {
		const [record] = await this.db
			.select()
			.from(records)
			.where(and(eq(records.id, recordId), eq(records.teamId, ctx.teamId)));

		if (!record) throw new Error('Record not found');

		const updatedProvenance = this.provenanceService.addVerification(
			record.provenance as Record<string, any>,
			field,
			{
				by: ctx.agentId ?? ctx.userId,
				method,
				outcome,
			},
		);

		const [updated] = await this.db
			.update(records)
			.set({ provenance: updatedProvenance, updatedAt: new Date() })
			.where(eq(records.id, recordId))
			.returning();

		// Emit event + audit
		const eventScope = await this.resolveEventScope(record.tableId);
		if (this.eventService) {
			await this.eventService.emit({
				eventType: 'field.changed',
				teamId: ctx.teamId,
				...eventScope,
				recordId,
				field,
				data: { method, outcome },
			});
		}
		if (this.auditService) {
			await this.auditService.log(ctx, {
				action: 'update',
				resourceType: 'record',
				resourceId: recordId,
				metadata: { field, verification: { method, outcome } },
			});
		}

		return updated;
	}

	async bulkImport(ctx: RequestContext, tableId: string, items: Record<string, unknown>[]) {
		// Permission check once
		await this.checkPermission(ctx, tableId, 'create');

		// Wrap all in one transaction
		const created = await this.db.transaction(async (tx) => {
			const results = [];
			for (const data of items) {
				const violations = await this.constraintService.validate(tableId, data);
				if (violations.length > 0) {
					throw new Error(
						`Validation failed for item: ${violations.map((v) => v.message).join('; ')}`,
					);
				}

				const provenance = this.provenanceService.buildProvenance(data, ctx.agentId ?? ctx.userId);

				const [rec] = await tx
					.insert(records)
					.values({
						teamId: ctx.teamId,
						tableId,
						data,
						provenance,
						createdBy: ctx.userId,
						updatedBy: ctx.userId,
					})
					.returning();

				await this.indexService.updateIndexes(rec.id, ctx.teamId, tableId, data, tx);
				results.push(rec);
			}
			return results;
		});

		// Emit individual record.created events (fire-and-forget, outside transaction)
		const eventScope = await this.resolveEventScope(tableId);
		if (this.eventService) {
			for (const rec of created) {
				this.eventService
					.emit({
						eventType: 'record.created',
						teamId: ctx.teamId,
						...eventScope,
						recordId: rec.id,
						data: rec.data as Record<string, unknown>,
					})
					.catch(() => {
						/* fire-and-forget */
					});
			}
		}

		// Audit
		if (this.auditService) {
			await this.auditService.log(ctx, {
				action: 'create',
				resourceType: 'record',
				tableId,
				metadata: { bulkImport: true, count: created.length },
			});
		}

		return created;
	}
}
