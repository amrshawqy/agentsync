import { boolean, pgTable, text, timestamp, unique, uuid, varchar } from 'drizzle-orm/pg-core';
import { teams } from './teams.js';

export const agentKitTemplates = pgTable(
	'agent_kit_templates',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		teamId: uuid('team_id').references(() => teams.id),
		format: varchar('format', { length: 50 }).notNull(),
		component: varchar('component', { length: 50 }).notNull(),
		template: text('template').notNull(),
		isActive: boolean('is_active').default(true),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
	},
	(t) => [unique('uq_agent_kit_templates').on(t.teamId, t.format, t.component)],
);
