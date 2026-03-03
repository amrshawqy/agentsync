import { pgTable, uuid, varchar, text, integer, timestamp, index } from 'drizzle-orm/pg-core';
import { blueprints } from './blueprints.js';
import { teams } from './teams.js';
import { users } from './users.js';

export const blueprintReviews = pgTable('blueprint_reviews', {
	id: uuid('id').primaryKey().defaultRandom(),
	blueprintId: uuid('blueprint_id').notNull().references(() => blueprints.id),
	teamId: uuid('team_id').notNull().references(() => teams.id),
	userId: uuid('user_id').notNull().references(() => users.id),
	rating: integer('rating').notNull(),
	title: varchar('title', { length: 255 }),
	body: text('body'),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
	index('idx_blueprint_reviews_bp').on(t.blueprintId),
	index('idx_blueprint_reviews_team').on(t.teamId),
]);
