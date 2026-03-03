import { pgTable, uuid, varchar, integer, timestamp, index } from 'drizzle-orm/pg-core';
import { accounts } from './accounts.js';

export const emailOtpChallenges = pgTable('email_otp_challenges', {
	id: uuid('id').primaryKey().defaultRandom(),
	accountId: uuid('account_id').notNull().references(() => accounts.id),
	email: varchar('email', { length: 255 }).notNull(),
	otpHash: varchar('otp_hash', { length: 255 }).notNull(),
	purpose: varchar('purpose', { length: 50 }).notNull().default('verify_email'),
	attemptCount: integer('attempt_count').notNull().default(0),
	expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
	consumedAt: timestamp('consumed_at', { withTimezone: true }),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
	index('idx_email_otp_account').on(t.accountId),
	index('idx_email_otp_expires').on(t.expiresAt),
]);
