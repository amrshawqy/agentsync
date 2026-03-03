import { pgTable, uuid, varchar, jsonb, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { accounts } from './accounts.js';

export const agents = pgTable('agents', {
	id: uuid('id').primaryKey().defaultRandom(),
	accountId: uuid('account_id').notNull().references(() => accounts.id),
	thumbprint: varchar('thumbprint', { length: 255 }).notNull(),
	publicKeyJwk: jsonb('public_key_jwk').notNull(),
	label: varchar('label', { length: 255 }),
	status: varchar('status', { length: 20 }).notNull().default('active'),
	lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
	uniqueIndex('uq_agents_thumbprint').on(t.thumbprint),
	index('idx_agents_account').on(t.accountId),
]);
