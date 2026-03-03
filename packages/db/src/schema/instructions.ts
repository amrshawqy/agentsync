import { pgTable, uuid, varchar, text, integer, boolean, timestamp } from 'drizzle-orm/pg-core';
import { teams } from './teams.js';

export const instructions = pgTable('instructions', {
	id: uuid('id').primaryKey().defaultRandom(),
	teamId: uuid('team_id').notNull().references(() => teams.id),
	scope: varchar('scope', { length: 50 }).notNull(),
	scopeId: uuid('scope_id'),
	instructionType: varchar('instruction_type', { length: 50 }),
	content: text('content').notNull(),
	priority: integer('priority').default(0),
	isActive: boolean('is_active').default(true),
	version: integer('version').default(1),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
