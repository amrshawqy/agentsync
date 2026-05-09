import { pgTable, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

export const setupTokens = pgTable(
	'setup_tokens',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		tokenHash: varchar('token_hash', { length: 255 }).notNull(),
		expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
		consumedAt: timestamp('consumed_at', { withTimezone: true }),
		consumedByAccountId: uuid('consumed_by_account_id'),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	},
	(t) => [uniqueIndex('uq_setup_tokens_hash').on(t.tokenHash)],
);
