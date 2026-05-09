import { index, jsonb, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { schemaTables } from './schema-tables.js';
import { users } from './users.js';

export const records = pgTable(
	'records',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		teamId: uuid('team_id').notNull(),
		tableId: uuid('table_id')
			.notNull()
			.references(() => schemaTables.id),
		data: jsonb('data').notNull().default({}),
		provenance: jsonb('provenance').notNull().default({}),
		createdBy: uuid('created_by').references(() => users.id),
		updatedBy: uuid('updated_by').references(() => users.id),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
		deletedAt: timestamp('deleted_at', { withTimezone: true }),
	},
	(t) => [
		index('idx_records_team_table').on(t.teamId, t.tableId),
		index('idx_records_created').on(t.teamId, t.tableId, t.createdAt),
		index('idx_records_data').using('gin', t.data),
		index('idx_records_provenance').using('gin', t.provenance),
	],
);
