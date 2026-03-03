import { pgTable, uuid, varchar, text, boolean, jsonb, integer, timestamp, unique } from 'drizzle-orm/pg-core';
import { teams } from './teams.js';
import { schemaTables } from './schema-tables.js';

export const schemaFields = pgTable('schema_fields', {
	id: uuid('id').primaryKey().defaultRandom(),
	teamId: uuid('team_id').notNull().references(() => teams.id),
	tableId: uuid('table_id').notNull().references(() => schemaTables.id),
	name: varchar('name', { length: 255 }).notNull(),
	slug: varchar('slug', { length: 100 }).notNull(),
	fieldType: varchar('field_type', { length: 50 }).notNull(),
	isRequired: boolean('is_required').default(false),
	isIndexed: boolean('is_indexed').default(false),
	defaultValue: jsonb('default_value'),
	validation: jsonb('validation'),
	options: jsonb('options'),
	constraints: jsonb('constraints'),
	relationConfig: jsonb('relation_config'),
	rollupConfig: jsonb('rollup_config'),
	agentHint: text('agent_hint'),
	sourceLayer: varchar('source_layer', { length: 20 }).notNull(),
	fieldOrder: integer('field_order').default(0),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
	unique('uq_schema_fields_table_slug').on(t.tableId, t.slug),
]);
