import { relations } from 'drizzle-orm';
import {
	accountRefreshTokens,
	accounts,
	agentAuthChallenges,
	agentKitGenerations,
	agentKitTemplates,
	agents,
	automations,
	blueprintReviews,
	blueprints,
	emailOtpChallenges,
	eventSubscriptions,
	fieldSuggestions,
	instructions,
	oauthClients,
	recordIndexes,
	recordRelations,
	records,
	refreshTokens,
	roles,
	schemaFields,
	schemaTables,
	teamInvites,
	teams,
	users,
	workspaces,
} from './schema/index.js';

export const teamsRelations = relations(teams, ({ many }) => ({
	users: many(users),
	roles: many(roles),
	workspaces: many(workspaces),
	schemaTables: many(schemaTables),
	instructions: many(instructions),
	eventSubscriptions: many(eventSubscriptions),
	agentKitTemplates: many(agentKitTemplates),
	agentKitGenerations: many(agentKitGenerations),
	oauthClients: many(oauthClients),
	teamInvites: many(teamInvites),
}));

export const accountsRelations = relations(accounts, ({ many }) => ({
	users: many(users),
	agents: many(agents),
	emailOtpChallenges: many(emailOtpChallenges),
	refreshTokens: many(accountRefreshTokens),
}));

export const rolesRelations = relations(roles, ({ one, many }) => ({
	team: one(teams, { fields: [roles.teamId], references: [teams.id] }),
	users: many(users),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
	account: one(accounts, { fields: [users.accountId], references: [accounts.id] }),
	team: one(teams, { fields: [users.teamId], references: [teams.id] }),
	role: one(roles, { fields: [users.roleId], references: [roles.id] }),
	eventSubscriptions: many(eventSubscriptions),
	agentKitGenerations: many(agentKitGenerations),
	refreshTokens: many(refreshTokens),
	sentTeamInvites: many(teamInvites),
}));

export const agentsRelations = relations(agents, ({ one }) => ({
	account: one(accounts, { fields: [agents.accountId], references: [accounts.id] }),
}));

export const workspacesRelations = relations(workspaces, ({ one, many }) => ({
	team: one(teams, { fields: [workspaces.teamId], references: [teams.id] }),
	blueprint: one(blueprints, { fields: [workspaces.blueprintId], references: [blueprints.id] }),
	tables: many(schemaTables),
}));

export const blueprintsRelations = relations(blueprints, ({ one, many }) => ({
	createdByTeam: one(teams, { fields: [blueprints.createdByTeam], references: [teams.id] }),
	workspaces: many(workspaces),
}));

export const schemaTablesRelations = relations(schemaTables, ({ one, many }) => ({
	team: one(teams, { fields: [schemaTables.teamId], references: [teams.id] }),
	workspace: one(workspaces, {
		fields: [schemaTables.workspaceId],
		references: [workspaces.id],
	}),
	blueprint: one(blueprints, {
		fields: [schemaTables.blueprintId],
		references: [blueprints.id],
	}),
	fields: many(schemaFields),
	records: many(records),
	fieldSuggestions: many(fieldSuggestions),
}));

export const schemaFieldsRelations = relations(schemaFields, ({ one, many }) => ({
	team: one(teams, { fields: [schemaFields.teamId], references: [teams.id] }),
	table: one(schemaTables, { fields: [schemaFields.tableId], references: [schemaTables.id] }),
	recordIndexes: many(recordIndexes),
}));

export const recordsRelations = relations(records, ({ one, many }) => ({
	table: one(schemaTables, { fields: [records.tableId], references: [schemaTables.id] }),
	createdByUser: one(users, {
		fields: [records.createdBy],
		references: [users.id],
		relationName: 'createdBy',
	}),
	updatedByUser: one(users, {
		fields: [records.updatedBy],
		references: [users.id],
		relationName: 'updatedBy',
	}),
	indexes: many(recordIndexes),
	sourceRelations: many(recordRelations, { relationName: 'source' }),
	targetRelations: many(recordRelations, { relationName: 'target' }),
}));

export const recordIndexesRelations = relations(recordIndexes, ({ one }) => ({
	record: one(records, { fields: [recordIndexes.recordId], references: [records.id] }),
	field: one(schemaFields, { fields: [recordIndexes.fieldId], references: [schemaFields.id] }),
}));

export const recordRelationsRelations = relations(recordRelations, ({ one }) => ({
	sourceRecord: one(records, {
		fields: [recordRelations.sourceRecordId],
		references: [records.id],
		relationName: 'source',
	}),
	targetRecord: one(records, {
		fields: [recordRelations.targetRecordId],
		references: [records.id],
		relationName: 'target',
	}),
	field: one(schemaFields, {
		fields: [recordRelations.fieldId],
		references: [schemaFields.id],
	}),
	createdByUser: one(users, {
		fields: [recordRelations.createdBy],
		references: [users.id],
	}),
}));

export const eventSubscriptionsRelations = relations(eventSubscriptions, ({ one }) => ({
	team: one(teams, { fields: [eventSubscriptions.teamId], references: [teams.id] }),
	user: one(users, { fields: [eventSubscriptions.userId], references: [users.id] }),
	workspace: one(workspaces, {
		fields: [eventSubscriptions.workspaceId],
		references: [workspaces.id],
	}),
	table: one(schemaTables, {
		fields: [eventSubscriptions.tableId],
		references: [schemaTables.id],
	}),
}));

export const fieldSuggestionsRelations = relations(fieldSuggestions, ({ one }) => ({
	team: one(teams, { fields: [fieldSuggestions.teamId], references: [teams.id] }),
	table: one(schemaTables, {
		fields: [fieldSuggestions.tableId],
		references: [schemaTables.id],
	}),
	suggestedByUser: one(users, {
		fields: [fieldSuggestions.suggestedBy],
		references: [users.id],
		relationName: 'suggestedBy',
	}),
	reviewedByUser: one(users, {
		fields: [fieldSuggestions.reviewedBy],
		references: [users.id],
		relationName: 'reviewedBy',
	}),
}));

export const instructionsRelations = relations(instructions, ({ one }) => ({
	team: one(teams, { fields: [instructions.teamId], references: [teams.id] }),
}));

export const agentKitTemplatesRelations = relations(agentKitTemplates, ({ one }) => ({
	team: one(teams, { fields: [agentKitTemplates.teamId], references: [teams.id] }),
}));

export const agentKitGenerationsRelations = relations(agentKitGenerations, ({ one }) => ({
	team: one(teams, { fields: [agentKitGenerations.teamId], references: [teams.id] }),
	user: one(users, { fields: [agentKitGenerations.userId], references: [users.id] }),
}));

export const oauthClientsRelations = relations(oauthClients, ({ one }) => ({
	team: one(teams, { fields: [oauthClients.teamId], references: [teams.id] }),
}));

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
	user: one(users, { fields: [refreshTokens.userId], references: [users.id] }),
}));

export const accountRefreshTokensRelations = relations(accountRefreshTokens, ({ one }) => ({
	account: one(accounts, { fields: [accountRefreshTokens.accountId], references: [accounts.id] }),
}));

export const teamInvitesRelations = relations(teamInvites, ({ one }) => ({
	team: one(teams, { fields: [teamInvites.teamId], references: [teams.id] }),
	role: one(roles, { fields: [teamInvites.roleId], references: [roles.id] }),
	invitedByUser: one(users, { fields: [teamInvites.invitedByUserId], references: [users.id] }),
}));

export const emailOtpChallengesRelations = relations(emailOtpChallenges, ({ one }) => ({
	account: one(accounts, { fields: [emailOtpChallenges.accountId], references: [accounts.id] }),
}));

export const agentAuthChallengesRelations = relations(agentAuthChallenges, () => ({}));

export const blueprintReviewsRelations = relations(blueprintReviews, ({ one }) => ({
	blueprint: one(blueprints, {
		fields: [blueprintReviews.blueprintId],
		references: [blueprints.id],
	}),
	team: one(teams, { fields: [blueprintReviews.teamId], references: [teams.id] }),
	user: one(users, { fields: [blueprintReviews.userId], references: [users.id] }),
}));

export const automationsRelations = relations(automations, ({ one }) => ({
	team: one(teams, { fields: [automations.teamId], references: [teams.id] }),
	workspace: one(workspaces, { fields: [automations.workspaceId], references: [workspaces.id] }),
	createdByUser: one(users, { fields: [automations.createdBy], references: [users.id] }),
}));
