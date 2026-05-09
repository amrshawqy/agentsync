import type { SchemaField } from './schema-field.js';
import type { SchemaTable } from './schema-table.js';
import type { Workspace } from './workspace.js';

export interface SchemaTableWithFields extends SchemaTable {
	fields: SchemaField[];
}

export interface SchemaOverview {
	workspace: Workspace;
	tables: SchemaTableWithFields[];
}
