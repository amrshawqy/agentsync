import { index, jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { schemaTables } from './schema-tables.js';
import { teams } from './teams.js';
import { users } from './users.js';

export const fieldSuggestions = pgTable(
	'field_suggestions',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		teamId: uuid('team_id')
			.notNull()
			.references(() => teams.id),
		tableId: uuid('table_id')
			.notNull()
			.references(() => schemaTables.id),
		suggestedBy: uuid('suggested_by')
			.notNull()
			.references(() => users.id),
		fieldName: varchar('field_name', { length: 255 }).notNull(),
		fieldSlug: varchar('field_slug', { length: 100 }).notNull(),
		fieldType: varchar('field_type', { length: 50 }).notNull(),
		agentHint: text('agent_hint'),
		rationale: text('rationale').notNull(),
		exampleValue: jsonb('example_value'),
		status: varchar('status', { length: 20 }).default('pending'),
		reviewedBy: uuid('reviewed_by').references(() => users.id),
		reviewNote: text('review_note'),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
	},
	(t) => [index('idx_field_suggestions_pending').on(t.teamId, t.status)],
);
