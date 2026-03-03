import { pgTable, uuid, varchar, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';

export const agentAuthChallenges = pgTable('agent_auth_challenges', {
	id: uuid('id').primaryKey().defaultRandom(),
	challenge: varchar('challenge', { length: 255 }).notNull(),
	publicKeyJwk: varchar('public_key_jwk', { length: 4000 }).notNull(),
	label: varchar('label', { length: 255 }),
	expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
	consumedAt: timestamp('consumed_at', { withTimezone: true }),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
	uniqueIndex('uq_agent_auth_challenge').on(t.challenge),
	index('idx_agent_auth_expires').on(t.expiresAt),
]);
