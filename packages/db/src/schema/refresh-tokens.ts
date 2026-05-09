import { boolean, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const refreshTokens = pgTable('refresh_tokens', {
	id: uuid('id').primaryKey().defaultRandom(),
	token: varchar('token', { length: 255 }).notNull().unique(),
	userId: uuid('user_id')
		.notNull()
		.references(() => users.id),
	clientId: varchar('client_id', { length: 255 }).notNull(),
	scope: varchar('scope', { length: 500 }),
	revoked: boolean('revoked').default(false),
	expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
