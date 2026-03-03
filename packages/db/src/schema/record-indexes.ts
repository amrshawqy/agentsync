import { pgTable, uuid, varchar, numeric, timestamp as pgTimestamp, boolean, primaryKey, index } from 'drizzle-orm/pg-core';
import { records } from './records.js';
import { schemaFields } from './schema-fields.js';

export const recordIndexes = pgTable('record_indexes', {
	recordId: uuid('record_id').notNull().references(() => records.id, { onDelete: 'cascade' }),
	teamId: uuid('team_id').notNull(),
	tableId: uuid('table_id').notNull(),
	fieldId: uuid('field_id').notNull().references(() => schemaFields.id),
	textValue: varchar('text_value'),
	numberValue: numeric('number_value'),
	dateValue: pgTimestamp('date_value', { withTimezone: true }),
	boolValue: boolean('bool_value'),
}, (t) => [
	primaryKey({ columns: [t.recordId, t.fieldId] }),
	index('idx_ri_text').on(t.teamId, t.tableId, t.fieldId, t.textValue),
	index('idx_ri_number').on(t.teamId, t.tableId, t.fieldId, t.numberValue),
	index('idx_ri_date').on(t.teamId, t.tableId, t.fieldId, t.dateValue),
]);
