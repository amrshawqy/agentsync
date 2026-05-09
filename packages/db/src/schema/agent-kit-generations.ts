import { index, pgTable, timestamp, unique, uuid, varchar } from 'drizzle-orm/pg-core';
import { teams } from './teams.js';
import { users } from './users.js';

export const agentKitGenerations = pgTable(
	'agent_kit_generations',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		teamId: uuid('team_id')
			.notNull()
			.references(() => teams.id),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id),
		format: varchar('format', { length: 50 }).notNull(),
		schemaVersionHash: varchar('schema_version_hash', { length: 64 }).notNull(),
		generatedAt: timestamp('generated_at', { withTimezone: true }).defaultNow().notNull(),
	},
	(t) => [
		unique('uq_agent_kit_generations').on(t.teamId, t.userId, t.format),
		index('idx_akg_staleness').on(t.teamId, t.schemaVersionHash),
	],
);
