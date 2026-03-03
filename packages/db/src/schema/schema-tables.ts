import { pgTable, uuid, varchar, text, jsonb, timestamp, unique } from 'drizzle-orm/pg-core';
import { teams } from './teams.js';
import { workspaces } from './workspaces.js';
import { blueprints } from './blueprints.js';

export const schemaTables = pgTable('schema_tables', {
	id: uuid('id').primaryKey().defaultRandom(),
	teamId: uuid('team_id').notNull().references(() => teams.id),
	workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id),
	name: varchar('name', { length: 255 }).notNull(),
	slug: varchar('slug', { length: 100 }).notNull(),
	description: text('description'),
	agentHint: text('agent_hint'),
	sourceLayer: varchar('source_layer', { length: 20 }).notNull(),
	blueprintId: uuid('blueprint_id').references(() => blueprints.id),
	settings: jsonb('settings').default({}),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
	unique('uq_schema_tables_team_ws_slug').on(t.teamId, t.workspaceId, t.slug),
]);
