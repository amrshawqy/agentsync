import { pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const oauthCodes = pgTable('oauth_codes', {
	id: uuid('id').primaryKey().defaultRandom(),
	code: varchar('code', { length: 255 }).notNull().unique(),
	userId: uuid('user_id')
		.notNull()
		.references(() => users.id),
	clientId: varchar('client_id', { length: 255 }).notNull(),
	redirectUri: text('redirect_uri').notNull(),
	scope: text('scope'),
	codeChallenge: varchar('code_challenge', { length: 255 }).notNull(),
	codeChallengeMethod: varchar('code_challenge_method', { length: 10 }).notNull().default('S256'),
	expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
