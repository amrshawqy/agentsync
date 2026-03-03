import { pgTable, uuid, varchar, text, integer, boolean, jsonb, numeric, timestamp, unique } from 'drizzle-orm/pg-core';
import { teams } from './teams.js';

export const blueprints = pgTable('blueprints', {
	id: uuid('id').primaryKey().defaultRandom(),
	slug: varchar('slug', { length: 100 }).notNull(),
	name: varchar('name', { length: 255 }).notNull(),
	description: text('description'),
	category: varchar('category', { length: 100 }),
	version: integer('version').notNull().default(1),
	isBuiltin: boolean('is_builtin').default(false),
	createdByTeam: uuid('created_by_team').references(() => teams.id),
	schemaDefinition: jsonb('schema_definition').notNull(),
	seedData: jsonb('seed_data'),
	instructions: jsonb('instructions'),
	isPublished: boolean('is_published').default(false),
	marketplaceTags: text('marketplace_tags').array(),
	installCount: integer('install_count').default(0),
	avgRating: numeric('avg_rating', { precision: 2, scale: 1 }),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
	unique('uq_blueprints_slug_version').on(t.slug, t.version),
]);
