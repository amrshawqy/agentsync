import { pgTable, uuid, varchar, timestamp, boolean, index } from 'drizzle-orm/pg-core';
import { accounts } from './accounts.js';

export const accountRefreshTokens = pgTable('account_refresh_tokens', {
	id: uuid('id').primaryKey().defaultRandom(),
	token: varchar('token', { length: 255 }).notNull().unique(),
	accountId: uuid('account_id').notNull().references(() => accounts.id),
	clientId: varchar('client_id', { length: 255 }).notNull().default('agentsync-onboarding'),
	revoked: boolean('revoked').notNull().default(false),
	expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
	index('idx_account_refresh_account').on(t.accountId),
]);
