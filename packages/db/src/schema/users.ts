import { pgTable, uuid, varchar, timestamp, unique } from 'drizzle-orm/pg-core';
import { teams } from './teams.js';
import { roles } from './roles.js';
import { accounts } from './accounts.js';

export const users = pgTable('users', {
	id: uuid('id').primaryKey().defaultRandom(),
	accountId: uuid('account_id').references(() => accounts.id),
	teamId: uuid('team_id').notNull().references(() => teams.id),
	email: varchar('email', { length: 255 }).notNull(),
	name: varchar('name', { length: 255 }),
	roleId: uuid('role_id').references(() => roles.id),
	agentId: varchar('agent_id', { length: 255 }),
	status: varchar('status', { length: 20 }).default('invited'),
	lastConnectedAt: timestamp('last_connected_at', { withTimezone: true }),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
	unique('uq_users_team_email').on(t.teamId, t.email),
]);
