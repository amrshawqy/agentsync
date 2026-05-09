import {
	boolean,
	index,
	jsonb,
	pgTable,
	text,
	timestamp,
	uuid,
	varchar,
} from 'drizzle-orm/pg-core';
import { schemaTables } from './schema-tables.js';
import { teams } from './teams.js';
import { users } from './users.js';
import { workspaces } from './workspaces.js';

export const eventSubscriptions = pgTable(
	'event_subscriptions',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		teamId: uuid('team_id')
			.notNull()
			.references(() => teams.id),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id),
		eventType: varchar('event_type', { length: 50 }).notNull(),
		workspaceId: uuid('workspace_id').references(() => workspaces.id),
		tableId: uuid('table_id').references(() => schemaTables.id),
		fieldSlug: varchar('field_slug', { length: 100 }),
		condition: jsonb('condition'),
		callbackType: varchar('callback_type', { length: 20 }).notNull(),
		callbackUrl: text('callback_url'),
		isActive: boolean('is_active').default(true),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	},
	(t) => [index('idx_event_subs_lookup').on(t.teamId, t.eventType, t.isActive)],
);
