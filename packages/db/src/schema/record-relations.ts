import { index, pgTable, timestamp, unique, uuid, varchar } from 'drizzle-orm/pg-core';
import { records } from './records.js';
import { schemaFields } from './schema-fields.js';
import { users } from './users.js';

export const recordRelations = pgTable(
	'record_relations',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		teamId: uuid('team_id').notNull(),
		sourceRecordId: uuid('source_record_id')
			.notNull()
			.references(() => records.id, { onDelete: 'cascade' }),
		targetRecordId: uuid('target_record_id')
			.notNull()
			.references(() => records.id, { onDelete: 'cascade' }),
		relationType: varchar('relation_type', { length: 100 }).notNull(),
		fieldId: uuid('field_id').references(() => schemaFields.id),
		createdBy: uuid('created_by').references(() => users.id),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	},
	(t) => [
		unique('uq_record_relations').on(t.sourceRecordId, t.targetRecordId, t.relationType),
		index('idx_record_relations_source').on(t.sourceRecordId),
		index('idx_record_relations_target').on(t.targetRecordId),
		index('idx_rr_type').on(t.teamId, t.relationType),
	],
);
