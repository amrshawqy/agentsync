import { eq, and, sql } from 'drizzle-orm';
import type { Database } from '@agentsync/db';
import { blueprints, workspaces, schemaTables, schemaFields, records } from '@agentsync/db';
import type { CreateBlueprint, BlueprintSchemaDefinition } from '@agentsync/types';
import { validateBlueprintSchema } from './validator.js';
import type { SchemaService } from '../schema/schema.service.js';
import type { ConstraintService } from '../schema/constraint.service.js';
import type { ProvenanceService } from '../data/provenance.service.js';

export class BlueprintService {
	constructor(
		private db: Database,
		private schemaService: SchemaService,
		private constraintService: ConstraintService,
		private provenanceService: ProvenanceService,
	) {}

	async create(input: CreateBlueprint, createdByTeam?: string) {
		const validation = validateBlueprintSchema(input.schemaDefinition);
		if (!validation.valid) {
			throw new Error(`Invalid blueprint: ${validation.errors.join('; ')}`);
		}

		const [bp] = await this.db
			.insert(blueprints)
			.values({
				slug: input.slug,
				name: input.name,
				description: input.description,
				category: input.category,
				schemaDefinition: input.schemaDefinition,
				seedData: input.seedData,
				instructions: input.instructions,
				marketplaceTags: input.marketplaceTags,
				createdByTeam,
			})
			.returning();

		return bp;
	}

	async getBySlug(slug: string, version?: number) {
		const conditions = [eq(blueprints.slug, slug)];
		if (version) {
			conditions.push(eq(blueprints.version, version));
		}

		const results = await this.db
			.select()
			.from(blueprints)
			.where(and(...conditions))
			.orderBy(blueprints.version);

		return version ? results[0] ?? null : results[results.length - 1] ?? null;
	}

	async getById(id: string) {
		const [bp] = await this.db.select().from(blueprints).where(eq(blueprints.id, id));
		return bp ?? null;
	}

	async listBuiltin() {
		return this.db
			.select()
			.from(blueprints)
			.where(eq(blueprints.isBuiltin, true));
	}

	async listPublished() {
		return this.db
			.select()
			.from(blueprints)
			.where(eq(blueprints.isPublished, true));
	}

	async publish(slug: string) {
		const existing = await this.getBySlug(slug);
		if (!existing) throw new Error(`Blueprint not found: ${slug}`);

		const [published] = await this.db
			.update(blueprints)
			.set({ isPublished: true, updatedAt: new Date() })
			.where(eq(blueprints.id, existing.id))
			.returning();

		return published;
	}

	async incrementInstallCount(blueprintId: string) {
		await this.db
			.update(blueprints)
			.set({ installCount: sql`${blueprints.installCount} + 1` })
			.where(eq(blueprints.id, blueprintId));
	}

	async evolve(slug: string, changes: Record<string, unknown>) {
		const existing = await this.getBySlug(slug);
		if (!existing) throw new Error(`Blueprint not found: ${slug}`);

		const newSchema = { ...(existing.schemaDefinition as any), ...changes };
		const newVersion = existing.version + 1;

		const [evolved] = await this.db
			.insert(blueprints)
			.values({
				slug: existing.slug,
				name: existing.name,
				description: existing.description,
				category: existing.category,
				version: newVersion,
				isBuiltin: existing.isBuiltin,
				createdByTeam: existing.createdByTeam,
				schemaDefinition: newSchema,
				seedData: existing.seedData,
				instructions: existing.instructions,
				marketplaceTags: existing.marketplaceTags,
				isPublished: existing.isPublished,
			})
			.returning();

		return evolved;
	}

	async deploy(
		teamId: string,
		blueprintSlug: string,
		opts?: {
			workspaceName?: string;
			workspaceSlug?: string;
			includeSeedData?: boolean;
		},
	) {
		const bp = await this.getBySlug(blueprintSlug);
		if (!bp) throw new Error(`Blueprint not found: ${blueprintSlug}`);

		const schema = bp.schemaDefinition as BlueprintSchemaDefinition;
		const wsSlug = opts?.workspaceSlug ?? bp.slug;
		const wsName = opts?.workspaceName ?? bp.name;

		// Wrap entire deploy in a transaction for atomicity
		const result = await this.db.transaction(async (tx) => {
			// Create workspace
			const [workspace] = await tx
				.insert(workspaces)
				.values({
					teamId,
					name: wsName,
					slug: wsSlug,
					description: bp.description,
					blueprintId: bp.id,
					blueprintVersion: bp.version,
				})
				.returning();

			// Create tables and fields
			const tableMap = new Map<string, string>(); // tableDef.slug → table.id
			for (const tableDef of schema.tables) {
				const table = await this.schemaService.createTable(teamId, {
					name: tableDef.name,
					slug: tableDef.slug,
					workspaceId: workspace.id,
					description: tableDef.description,
					agentHint: tableDef.agentHint,
					sourceLayer: 'blueprint',
				}, tx);

				tableMap.set(tableDef.slug, table.id);

				for (let i = 0; i < tableDef.fields.length; i++) {
					const fieldDef = tableDef.fields[i];
					await this.schemaService.createField(teamId, table.id, {
						name: fieldDef.name ?? fieldDef.slug,
						slug: fieldDef.slug,
						fieldType: fieldDef.fieldType as any,
						isRequired: fieldDef.isRequired,
						isIndexed: fieldDef.isIndexed,
						validation: fieldDef.validation as any,
						options: fieldDef.options as any,
						constraints: fieldDef.constraints as any,
						relationConfig: fieldDef.relationConfig as any,
						rollupConfig: (fieldDef as any).rollupConfig,
						agentHint: fieldDef.agentHint,
						sourceLayer: 'blueprint',
						fieldOrder: i,
					}, tx);
				}
			}

			// Seed data if requested
			if (opts?.includeSeedData && bp.seedData) {
				// Pass 1: Insert all seed records, collect @ref map
				const refMap = new Map<string, string>(); // "@ref:tableSlug:index" → actual UUID
				const insertedRecords: Array<{ id: string; tableId: string; data: Record<string, unknown> }> = [];

				for (const tableDef of schema.tables) {
					const tableId = tableMap.get(tableDef.slug);
					if (!tableId) continue;

					const seedRecords = (bp.seedData as Record<string, any[]>)[tableDef.slug];
					if (!seedRecords) continue;

					for (let idx = 0; idx < seedRecords.length; idx++) {
						const data = seedRecords[idx];

						// Validate constraints
						const violations = await this.constraintService.validate(tableId, data);
						if (violations.length > 0) {
							throw new Error(`Seed data validation failed for ${tableDef.slug}[${idx}]: ${violations.map((v) => v.message).join('; ')}`);
						}

						// Build provenance via ProvenanceService
						const provenance = this.provenanceService.buildProvenance(data, 'blueprint-seed', 0.8);

						const [rec] = await tx.insert(records).values({
							teamId,
							tableId,
							data,
							provenance,
						}).returning();

						refMap.set(`@ref:${tableDef.slug}:${idx}`, rec.id);
						insertedRecords.push({ id: rec.id, tableId, data });
					}
				}

				// Pass 2: Resolve @ref: cross-references in inserted records
				for (const rec of insertedRecords) {
					let hasRef = false;
					const resolvedData: Record<string, unknown> = {};
					for (const [key, value] of Object.entries(rec.data)) {
						if (typeof value === 'string' && value.startsWith('@ref:')) {
							const resolved = refMap.get(value);
							if (resolved) {
								resolvedData[key] = resolved;
								hasRef = true;
							} else {
								resolvedData[key] = value;
							}
						} else {
							resolvedData[key] = value;
						}
					}
					if (hasRef) {
						await tx.update(records)
							.set({ data: resolvedData })
							.where(eq(records.id, rec.id));
					}
				}
			}

			return workspace;
		});

		// Track install count outside transaction
		await this.incrementInstallCount(bp.id);

		return result;
	}
}
