import type { Database } from '@agentsync/db';
import { records, schemaFields, schemaTables, workspaces } from '@agentsync/db';
import type {
	CreateSchemaField,
	CreateSchemaTable,
	SchemaField,
	SchemaTable,
} from '@agentsync/types';
import { and, eq, sql } from 'drizzle-orm';
import type { CacheService } from '../cache/cache.service.js';
import { resolveSchemaLayers } from './layer-resolver.js';

export class SchemaService {
	constructor(
		private db: Database,
		private cache: CacheService,
	) {}

	async getResolvedSchema(teamId: string, workspaceId: string) {
		const cacheKey = `schema:${teamId}:${workspaceId}`;
		const cached = await this.cache.get<any>(cacheKey);
		if (cached) return cached;

		// Get workspace to find blueprint
		const [workspace] = await this.db
			.select()
			.from(workspaces)
			.where(and(eq(workspaces.id, workspaceId), eq(workspaces.teamId, teamId)));

		// Fetch tables by source layer
		const allTables = await this.db
			.select()
			.from(schemaTables)
			.where(and(eq(schemaTables.teamId, teamId), eq(schemaTables.workspaceId, workspaceId)));

		const allFields = await this.db
			.select()
			.from(schemaFields)
			.where(eq(schemaFields.teamId, teamId));

		const fieldsByTable = new Map<string, any[]>();
		for (const field of allFields) {
			if (!fieldsByTable.has(field.tableId)) {
				fieldsByTable.set(field.tableId, []);
			}
			fieldsByTable.get(field.tableId)?.push(field);
		}

		const toResolved = (tables: any[]) =>
			tables.map((t) => ({
				table: t as SchemaTable,
				fields: (fieldsByTable.get(t.id) ?? []) as SchemaField[],
			}));

		const coreTables = allTables.filter((t) => t.sourceLayer === 'core');
		const blueprintTables = allTables.filter((t) => t.sourceLayer === 'blueprint');
		const workspaceTables = allTables.filter((t) => t.sourceLayer === 'workspace');

		const resolved = resolveSchemaLayers(
			toResolved(coreTables),
			toResolved(blueprintTables),
			toResolved(workspaceTables),
		);

		await this.cache.set(cacheKey, resolved, 600);
		return resolved;
	}

	async getSchemaOverview(teamId: string) {
		const cacheKey = `schema-overview:${teamId}`;
		const cached = await this.cache.get<any>(cacheKey);
		if (cached) return cached;

		const allWorkspaces = await this.db
			.select()
			.from(workspaces)
			.where(eq(workspaces.teamId, teamId));

		const overview: any[] = [];
		for (const ws of allWorkspaces) {
			const resolved = await this.getResolvedSchema(teamId, ws.id);
			overview.push({
				workspace: { id: ws.id, name: ws.name, slug: ws.slug },
				tables: resolved.map((r: any) => ({
					slug: r.table.slug,
					name: r.table.name,
					description: r.table.description,
					agentHint: r.table.agentHint,
					fields: r.fields.map((f: any) => ({
						slug: f.slug,
						name: f.name,
						fieldType: f.fieldType,
						isRequired: f.isRequired,
						agentHint: f.agentHint,
						constraints: f.constraints,
						options: f.options,
					})),
				})),
			});
		}

		await this.cache.set(cacheKey, overview, 600);
		return overview;
	}

	async createTable(teamId: string, input: CreateSchemaTable, tx?: any) {
		const executor = tx ?? this.db;
		const [table] = await executor
			.insert(schemaTables)
			.values({
				teamId,
				workspaceId: input.workspaceId,
				name: input.name,
				slug: input.slug,
				description: input.description,
				agentHint: input.agentHint,
				sourceLayer: input.sourceLayer ?? 'workspace',
			})
			.returning();

		await this.invalidateSchemaCache(teamId);
		return table;
	}

	async createField(teamId: string, tableId: string, input: CreateSchemaField, tx?: any) {
		const executor = tx ?? this.db;
		const [field] = await executor
			.insert(schemaFields)
			.values({
				teamId,
				tableId,
				name: input.name,
				slug: input.slug,
				fieldType: input.fieldType,
				isRequired: input.isRequired,
				isIndexed: input.isIndexed,
				defaultValue: input.defaultValue,
				validation: input.validation,
				options: input.options,
				constraints: input.constraints,
				relationConfig: input.relationConfig,
				rollupConfig: input.rollupConfig,
				agentHint: input.agentHint,
				sourceLayer: input.sourceLayer ?? 'workspace',
				fieldOrder: input.fieldOrder,
			})
			.returning();

		await this.invalidateSchemaCache(teamId);
		return field;
	}

	async getTableBySlug(teamId: string, workspaceId: string, slug: string) {
		const [table] = await this.db
			.select()
			.from(schemaTables)
			.where(
				and(
					eq(schemaTables.teamId, teamId),
					eq(schemaTables.workspaceId, workspaceId),
					eq(schemaTables.slug, slug),
				),
			);
		return table ?? null;
	}

	async findTableBySlug(teamId: string, slug: string) {
		const [table] = await this.db
			.select()
			.from(schemaTables)
			.where(and(eq(schemaTables.teamId, teamId), eq(schemaTables.slug, slug)));
		return table ?? null;
	}

	async getWorkspaceBySlug(teamId: string, slug: string) {
		const [ws] = await this.db
			.select()
			.from(workspaces)
			.where(and(eq(workspaces.teamId, teamId), eq(workspaces.slug, slug)));
		return ws ?? null;
	}

	async getWorkspaceById(workspaceId: string) {
		const [ws] = await this.db.select().from(workspaces).where(eq(workspaces.id, workspaceId));
		return ws ?? null;
	}

	async listWorkspaces(teamId: string) {
		return this.db.select().from(workspaces).where(eq(workspaces.teamId, teamId));
	}

	async createWorkspace(teamId: string, name: string, slug: string, description?: string) {
		const [ws] = await this.db
			.insert(workspaces)
			.values({ teamId, name, slug, description })
			.returning();
		await this.invalidateSchemaCache(teamId);
		return ws;
	}

	async alterTable(
		teamId: string,
		tableId: string,
		changes: {
			addFields?: Array<{
				name: string;
				slug: string;
				fieldType: string;
				isRequired?: boolean;
				isIndexed?: boolean;
				agentHint?: string;
				validation?: any;
				options?: any;
				constraints?: any;
				relationConfig?: any;
				rollupConfig?: any;
			}>;
			removeFields?: string[];
			updateFields?: Array<{
				slug: string;
				name?: string;
				agentHint?: string;
				isRequired?: boolean;
				isIndexed?: boolean;
				validation?: any;
				options?: any;
				constraints?: any;
				relationConfig?: any;
				rollupConfig?: any;
			}>;
		},
	) {
		const table = await this.getTableById(tableId);
		if (!table || table.teamId !== teamId) throw new Error('Table not found');

		const existingFields = await this.getFieldsForTable(tableId);

		if (changes.addFields) {
			for (let i = 0; i < changes.addFields.length; i++) {
				const f = changes.addFields[i];
				await this.createField(teamId, tableId, {
					name: f.name,
					slug: f.slug,
					fieldType: f.fieldType as any,
					isRequired: f.isRequired,
					isIndexed: f.isIndexed,
					agentHint: f.agentHint,
					validation: f.validation,
					options: f.options,
					constraints: f.constraints,
					relationConfig: f.relationConfig,
					rollupConfig: f.rollupConfig,
					sourceLayer: 'workspace',
					fieldOrder: existingFields.length + i,
				});
			}
		}

		if (changes.removeFields) {
			for (const slug of changes.removeFields) {
				const field = existingFields.find((f) => f.slug === slug);
				if (field) {
					await this.db.delete(schemaFields).where(eq(schemaFields.id, field.id));
				}
			}
		}

		if (changes.updateFields) {
			for (const upd of changes.updateFields) {
				const field = existingFields.find((f) => f.slug === upd.slug);
				if (field) {
					const set: Record<string, any> = {};
					if (upd.name !== undefined) set.name = upd.name;
					if (upd.agentHint !== undefined) set.agentHint = upd.agentHint;
					if (upd.isRequired !== undefined) set.isRequired = upd.isRequired;
					if (upd.isIndexed !== undefined) set.isIndexed = upd.isIndexed;
					if (upd.validation !== undefined) set.validation = upd.validation;
					if (upd.options !== undefined) set.options = upd.options;
					if (upd.constraints !== undefined) set.constraints = upd.constraints;
					if (upd.relationConfig !== undefined) set.relationConfig = upd.relationConfig;
					if (upd.rollupConfig !== undefined) set.rollupConfig = upd.rollupConfig;
					if (Object.keys(set).length > 0) {
						await this.db.update(schemaFields).set(set).where(eq(schemaFields.id, field.id));
					}
				}
			}
		}

		await this.invalidateSchemaCache(teamId);
		return this.getTableById(tableId);
	}

	async getWorkspaceStats(teamId: string, workspaceSlug: string) {
		const ws = await this.getWorkspaceBySlug(teamId, workspaceSlug);
		if (!ws) throw new Error('Workspace not found');

		const tables = await this.db
			.select()
			.from(schemaTables)
			.where(and(eq(schemaTables.teamId, teamId), eq(schemaTables.workspaceId, ws.id)));

		let totalRecords = 0;
		for (const table of tables) {
			const [count] = await this.db
				.select({ count: sql<number>`count(*)` })
				.from(records)
				.where(
					and(
						eq(records.tableId, table.id),
						eq(records.teamId, teamId),
						sql`records.deleted_at IS NULL`,
					),
				);
			totalRecords += Number(count?.count ?? 0);
		}

		return {
			workspace: { id: ws.id, name: ws.name, slug: ws.slug },
			tableCount: tables.length,
			totalRecords,
		};
	}

	async getTableById(tableId: string) {
		const [table] = await this.db.select().from(schemaTables).where(eq(schemaTables.id, tableId));
		return table ?? null;
	}

	async getFieldsForTable(tableId: string) {
		return this.db
			.select()
			.from(schemaFields)
			.where(eq(schemaFields.tableId, tableId))
			.orderBy(schemaFields.fieldOrder);
	}

	async invalidateSchemaCache(teamId: string): Promise<void> {
		await this.cache.delPattern(`schema:${teamId}:*`);
		await this.cache.delPattern(`schema-overview:${teamId}`);
	}
}
