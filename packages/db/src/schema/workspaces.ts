import { integer, pgTable, text, timestamp, unique, uuid, varchar } from 'drizzle-orm/pg-core';
import { blueprints } from './blueprints.js';
import { teams } from './teams.js';

export const workspaces = pgTable(
	'workspaces',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		teamId: uuid('team_id')
			.notNull()
			.references(() => teams.id),
		name: varchar('name', { length: 255 }).notNull(),
		slug: varchar('slug', { length: 100 }).notNull(),
		description: text('description'),
		blueprintId: uuid('blueprint_id').references(() => blueprints.id),
		blueprintVersion: integer('blueprint_version'),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	},
	(t) => [unique('uq_workspaces_team_slug').on(t.teamId, t.slug)],
);
