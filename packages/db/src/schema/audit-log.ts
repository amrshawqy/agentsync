import { index, jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

export const auditLog = pgTable(
	'audit_log',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		teamId: uuid('team_id').notNull(),
		userId: uuid('user_id'),
		agentId: varchar('agent_id', { length: 255 }),
		action: varchar('action', { length: 50 }).notNull(),
		resourceType: varchar('resource_type', { length: 50 }),
		resourceId: uuid('resource_id'),
		tableId: uuid('table_id'),
		reason: text('reason'),
		changes: jsonb('changes'),
		provenance: jsonb('provenance'),
		metadata: jsonb('metadata'),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	},
	(t) => [
		index('idx_audit_team_time').on(t.teamId, t.createdAt),
		index('idx_audit_user').on(t.teamId, t.userId),
		index('idx_audit_resource').on(t.teamId, t.resourceType, t.resourceId),
	],
);
