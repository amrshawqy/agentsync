import { pgTable, uuid, varchar, text, boolean, timestamp } from 'drizzle-orm/pg-core';
import { teams } from './teams.js';

export const oauthClients = pgTable('oauth_clients', {
	id: uuid('id').primaryKey().defaultRandom(),
	teamId: uuid('team_id').references(() => teams.id),
	clientId: varchar('client_id', { length: 255 }).notNull().unique(),
	clientSecret: varchar('client_secret', { length: 255 }),
	name: varchar('name', { length: 255 }).notNull(),
	redirectUris: text('redirect_uris').array().notNull(),
	isConfidential: boolean('is_confidential').default(true),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
