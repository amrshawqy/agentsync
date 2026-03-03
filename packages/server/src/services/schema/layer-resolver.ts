import type { SchemaField, SchemaTable } from '@agentsync/types';

interface ResolvedTable {
	table: SchemaTable;
	fields: SchemaField[];
}

/**
 * Merges schema layers: core → blueprint → workspace.
 * Workspace overrides blueprint, which overrides core.
 * Fields are merged by slug — later layers override earlier ones.
 */
export function resolveSchemaLayers(
	coreTables: ResolvedTable[],
	blueprintTables: ResolvedTable[],
	workspaceTables: ResolvedTable[],
): ResolvedTable[] {
	const tableMap = new Map<string, ResolvedTable>();

	// Layer 1: Core tables (always present)
	for (const entry of coreTables) {
		tableMap.set(entry.table.slug, entry);
	}

	// Layer 2: Blueprint tables (override/extend core)
	for (const entry of blueprintTables) {
		const existing = tableMap.get(entry.table.slug);
		if (existing) {
			tableMap.set(entry.table.slug, mergeTableEntry(existing, entry));
		} else {
			tableMap.set(entry.table.slug, entry);
		}
	}

	// Layer 3: Workspace tables (override/extend blueprint)
	for (const entry of workspaceTables) {
		const existing = tableMap.get(entry.table.slug);
		if (existing) {
			tableMap.set(entry.table.slug, mergeTableEntry(existing, entry));
		} else {
			tableMap.set(entry.table.slug, entry);
		}
	}

	return Array.from(tableMap.values());
}

function mergeTableEntry(base: ResolvedTable, override: ResolvedTable): ResolvedTable {
	const fieldMap = new Map<string, SchemaField>();

	for (const field of base.fields) {
		fieldMap.set(field.slug, field);
	}

	for (const field of override.fields) {
		fieldMap.set(field.slug, field);
	}

	return {
		table: {
			...base.table,
			...override.table,
			// Keep the original id if both exist
			id: override.table.id || base.table.id,
		},
		fields: Array.from(fieldMap.values()).sort((a, b) => a.fieldOrder - b.fieldOrder),
	};
}
