import { index, jsonb, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { records } from './records.js';
import { teams } from './teams.js';
import { users } from './users.js';

export const recordRevisions = pgTable(
	'record_revisions',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		recordId: uuid('record_id')
			.references(() => records.id, { onDelete: 'cascade' })
			.notNull(),
		teamId: uuid('team_id')
			.references(() => teams.id)
			.notNull(),
		revisionKind: varchar('revision_kind', { length: 16 }).notNull(),
		data: jsonb('data').notNull(),
		provenance: jsonb('provenance').$type<Record<string, unknown>>(),
		note: varchar('note', { length: 255 }),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		createdBy: uuid('created_by').references(() => users.id),
	},
	(t) => [
		index('idx_record_revisions_record').on(t.recordId, t.createdAt),
		index('idx_record_revisions_team_created').on(t.teamId, t.createdAt),
	],
);
