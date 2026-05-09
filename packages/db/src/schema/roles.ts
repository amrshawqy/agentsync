import { boolean, jsonb, pgTable, timestamp, unique, uuid, varchar } from 'drizzle-orm/pg-core';
import { teams } from './teams.js';

export const roles = pgTable(
	'roles',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		teamId: uuid('team_id')
			.notNull()
			.references(() => teams.id),
		name: varchar('name', { length: 100 }).notNull(),
		isSystem: boolean('is_system').default(false),
		permissions: jsonb('permissions').notNull().default({}),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	},
	(t) => [unique('uq_roles_team_name').on(t.teamId, t.name)],
);
