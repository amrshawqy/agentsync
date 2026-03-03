import { pgTable, uuid, varchar, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { teams } from './teams.js';
import { roles } from './roles.js';
import { users } from './users.js';

export const teamInvites = pgTable('team_invites', {
	id: uuid('id').primaryKey().defaultRandom(),
	teamId: uuid('team_id').notNull().references(() => teams.id),
	roleId: uuid('role_id').notNull().references(() => roles.id),
	invitedByUserId: uuid('invited_by_user_id').notNull().references(() => users.id),
	email: varchar('email', { length: 255 }),
	tokenHash: varchar('token_hash', { length: 255 }).notNull(),
	expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
	acceptedAt: timestamp('accepted_at', { withTimezone: true }),
	revokedAt: timestamp('revoked_at', { withTimezone: true }),
	status: varchar('status', { length: 20 }).notNull().default('pending'),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
	uniqueIndex('uq_team_invites_token').on(t.tokenHash),
	index('idx_team_invites_team_status').on(t.teamId, t.status),
]);
