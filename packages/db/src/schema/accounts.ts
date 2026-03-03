import { pgTable, uuid, varchar, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';

export const accounts = pgTable('accounts', {
	id: uuid('id').primaryKey().defaultRandom(),
	primaryEmail: varchar('primary_email', { length: 255 }),
	emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
	status: varchar('status', { length: 20 }).notNull().default('active'),
	limitsTier: varchar('limits_tier', { length: 20 }).notNull().default('unverified'),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
	uniqueIndex('uq_accounts_primary_email').on(t.primaryEmail),
	index('idx_accounts_status').on(t.status),
]);
