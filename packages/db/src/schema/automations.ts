import { pgTable, uuid, varchar, text, jsonb, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import { teams } from './teams.js';
import { workspaces } from './workspaces.js';
import { users } from './users.js';

export const automations = pgTable('automations', {
	id: uuid('id').primaryKey().defaultRandom(),
	teamId: uuid('team_id').notNull().references(() => teams.id),
	workspaceId: uuid('workspace_id').references(() => workspaces.id),
	name: varchar('name', { length: 255 }).notNull(),
	description: text('description'),
	trigger: jsonb('trigger').notNull().default({}),
	actions: jsonb('actions').notNull().default([]),
	isActive: boolean('is_active').default(true),
	createdBy: uuid('created_by').references(() => users.id),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
	index('idx_automations_team').on(t.teamId),
	index('idx_automations_workspace').on(t.teamId, t.workspaceId),
]);
