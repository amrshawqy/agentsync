import { z } from 'zod';
import { AgentKitFormat } from '../enums.js';

// Tool input schemas

export const CreateRecordToolInputSchema = z.object({
	table: z.string().describe('Table slug to create record in'),
	data: z.record(z.unknown()).describe('Field values for the new record'),
	confidence: z.number().min(0).max(1).optional().describe('Confidence score for provenance (0-1)'),
	links: z
		.array(
			z.object({
				targetRecordId: z.string().uuid(),
				relationType: z.string(),
			}),
		)
		.optional()
		.describe('Optional relations to create'),
});

export type CreateRecordToolInput = z.infer<typeof CreateRecordToolInputSchema>;

export const UpdateRecordToolInputSchema = z.object({
	recordId: z.string().uuid().describe('ID of the record to update'),
	updates: z.record(z.unknown()).describe('Fields to update'),
	confidence: z.number().min(0).max(1).optional().describe('Confidence score for provenance (0-1)'),
});

export type UpdateRecordToolInput = z.infer<typeof UpdateRecordToolInputSchema>;

export const DeleteRecordToolInputSchema = z.object({
	recordId: z.string().uuid().describe('ID of the record to delete'),
	reason: z.string().optional().describe('Reason for deletion (for audit)'),
});

export type DeleteRecordToolInput = z.infer<typeof DeleteRecordToolInputSchema>;

export const QueryRecordsToolInputSchema = z.object({
	table: z.string().describe('Table slug to query'),
	filters: z.record(z.unknown()).optional().describe('Field filters'),
	sort: z
		.array(
			z.object({
				field: z.string(),
				direction: z.enum(['asc', 'desc']).default('asc'),
			}),
		)
		.optional(),
	limit: z.number().int().min(1).max(100).default(20),
	offset: z.number().int().min(0).default(0),
	search: z.string().optional().describe('Full-text search query'),
});

export type QueryRecordsToolInput = z.infer<typeof QueryRecordsToolInputSchema>;

export const GetRecordToolInputSchema = z.object({
	recordId: z.string().uuid().describe('ID of the record to fetch'),
});

export type GetRecordToolInput = z.infer<typeof GetRecordToolInputSchema>;

export const LinkRecordsToolInputSchema = z.object({
	sourceRecordId: z.string().uuid(),
	targetRecordId: z.string().uuid(),
	relationType: z.string(),
});

export type LinkRecordsToolInput = z.infer<typeof LinkRecordsToolInputSchema>;

export const UnlinkRecordsToolInputSchema = z.object({
	sourceRecordId: z.string().uuid(),
	targetRecordId: z.string().uuid(),
	relationType: z.string(),
});

export type UnlinkRecordsToolInput = z.infer<typeof UnlinkRecordsToolInputSchema>;

export const TraverseToolInputSchema = z.object({
	startRecordId: z.string().uuid().describe('Record to start traversal from'),
	path: z.string().describe('Dot-separated relation path (e.g., "works_at.company")'),
	depth: z.number().int().min(1).max(5).default(2),
});

export type TraverseToolInput = z.infer<typeof TraverseToolInputSchema>;

export const SubscribeEventsToolInputSchema = z.object({
	eventType: z.string().describe('Event type to subscribe to'),
	table: z.string().optional().describe('Table slug to filter events'),
	condition: z.record(z.unknown()).optional(),
});

export type SubscribeEventsToolInput = z.infer<typeof SubscribeEventsToolInputSchema>;

export const UnsubscribeEventsToolInputSchema = z.object({
	subscriptionId: z.string().uuid(),
});

export type UnsubscribeEventsToolInput = z.infer<typeof UnsubscribeEventsToolInputSchema>;

export const DescribeTableToolInputSchema = z.object({
	table: z.string().describe('Table slug to describe'),
});

export type DescribeTableToolInput = z.infer<typeof DescribeTableToolInputSchema>;

export const SuggestFieldToolInputSchema = z.object({
	table: z.string().describe('Table slug'),
	fieldName: z.string(),
	fieldType: z.string(),
	rationale: z.string().describe('Why this field should be added'),
	exampleValue: z.unknown().optional(),
});

export type SuggestFieldToolInput = z.infer<typeof SuggestFieldToolInputSchema>;

export const GetAgentKitToolInputSchema = z.object({
	format: AgentKitFormat.describe('Target platform format'),
	memberId: z.string().uuid().optional().describe('Generate kit for specific member'),
});

export type GetAgentKitToolInput = z.infer<typeof GetAgentKitToolInputSchema>;

export const VerifyFieldToolInputSchema = z.object({
	recordId: z.string().uuid(),
	field: z.string(),
	method: z.string().describe('Verification method used'),
	outcome: z.enum(['valid', 'invalid', 'unconfirmed']),
});

export type VerifyFieldToolInput = z.infer<typeof VerifyFieldToolInputSchema>;

export const BulkImportToolInputSchema = z.object({
	table: z.string().describe('Table slug'),
	records: z.array(z.record(z.unknown())).min(1).max(1000),
});

export type BulkImportToolInput = z.infer<typeof BulkImportToolInputSchema>;

export const DeployBlueprintToolInputSchema = z.object({
	blueprintSlug: z.string(),
	workspaceName: z.string().optional(),
	workspaceSlug: z.string().optional(),
	includeSeedData: z.boolean().default(false),
});

export type DeployBlueprintToolInput = z.infer<typeof DeployBlueprintToolInputSchema>;

export const ListSubscriptionsToolInputSchema = z.object({
	activeOnly: z.boolean().default(true),
});

export type ListSubscriptionsToolInput = z.infer<typeof ListSubscriptionsToolInputSchema>;

// ── Schema Management Tool Inputs ──

export const CreateWorkspaceToolInputSchema = z.object({
	name: z.string().describe('Workspace name'),
	slug: z.string().describe('URL-friendly slug'),
	blueprintId: z.string().uuid().optional().describe('Deploy from blueprint'),
});
export type CreateWorkspaceToolInput = z.infer<typeof CreateWorkspaceToolInputSchema>;

export const CreateBlueprintToolInputSchema = z.object({
	slug: z.string(),
	name: z.string(),
	description: z.string().optional(),
	category: z.string().optional(),
	tables: z.array(
		z.object({
			slug: z.string(),
			name: z.string(),
			description: z.string().optional(),
			agentHint: z.string().optional(),
			fields: z.array(
				z.object({
					slug: z.string(),
					name: z.string(),
					fieldType: z.string(),
					isRequired: z.boolean().optional(),
					isIndexed: z.boolean().optional(),
					validation: z.record(z.unknown()).optional(),
					options: z.array(z.record(z.unknown())).optional(),
					constraints: z.record(z.unknown()).optional(),
					relationConfig: z.record(z.unknown()).optional(),
					rollupConfig: z.record(z.unknown()).optional(),
					agentHint: z.string().optional(),
				}),
			),
		}),
	),
});
export type CreateBlueprintToolInput = z.infer<typeof CreateBlueprintToolInputSchema>;

export const EvolveBlueprintToolInputSchema = z.object({
	blueprintSlug: z.string(),
	changes: z.record(z.unknown()).describe('Schema changes to apply'),
});
export type EvolveBlueprintToolInput = z.infer<typeof EvolveBlueprintToolInputSchema>;

export const CreateTableToolInputSchema = z.object({
	workspace: z.string().describe('Workspace slug'),
	name: z.string(),
	slug: z.string(),
	description: z.string().optional(),
	agentHint: z.string().optional(),
	fields: z
		.array(
			z.object({
				name: z.string(),
				slug: z.string(),
				fieldType: z.string(),
				isRequired: z.boolean().optional(),
				isIndexed: z.boolean().optional(),
				validation: z.record(z.unknown()).optional(),
				options: z.array(z.record(z.unknown())).optional(),
				constraints: z.record(z.unknown()).optional(),
				relationConfig: z.record(z.unknown()).optional(),
				rollupConfig: z.record(z.unknown()).optional(),
				agentHint: z.string().optional(),
			}),
		)
		.optional(),
});
export type CreateTableToolInput = z.infer<typeof CreateTableToolInputSchema>;

export const AlterTableToolInputSchema = z.object({
	workspace: z.string().optional().describe('Workspace slug'),
	table: z.string().describe('Table slug'),
	addFields: z
		.array(
			z.object({
				name: z.string(),
				slug: z.string(),
				fieldType: z.string(),
				isRequired: z.boolean().optional(),
				isIndexed: z.boolean().optional(),
				validation: z.record(z.unknown()).optional(),
				options: z.array(z.record(z.unknown())).optional(),
				constraints: z.record(z.unknown()).optional(),
				relationConfig: z.record(z.unknown()).optional(),
				rollupConfig: z.record(z.unknown()).optional(),
				agentHint: z.string().optional(),
			}),
		)
		.optional(),
	removeFields: z.array(z.string()).optional(),
	updateFields: z
		.array(
			z.object({
				slug: z.string(),
				name: z.string().optional(),
				agentHint: z.string().optional(),
				isRequired: z.boolean().optional(),
				isIndexed: z.boolean().optional(),
				validation: z.record(z.unknown()).optional(),
				options: z.array(z.record(z.unknown())).optional(),
				constraints: z.record(z.unknown()).optional(),
				relationConfig: z.record(z.unknown()).optional(),
				rollupConfig: z.record(z.unknown()).optional(),
			}),
		)
		.optional(),
});
export type AlterTableToolInput = z.infer<typeof AlterTableToolInputSchema>;

export const ListBlueprintsToolInputSchema = z.object({
	category: z.string().optional(),
});
export type ListBlueprintsToolInput = z.infer<typeof ListBlueprintsToolInputSchema>;

export const DescribeSchemaToolInputSchema = z.object({});
export type DescribeSchemaToolInput = z.infer<typeof DescribeSchemaToolInputSchema>;

// ── Context & Discovery Tool Inputs ──

export const GetContextToolInputSchema = z.object({});
export type GetContextToolInput = z.infer<typeof GetContextToolInputSchema>;

export const ListWorkspacesToolInputSchema = z.object({});
export type ListWorkspacesToolInput = z.infer<typeof ListWorkspacesToolInputSchema>;

export const ListTablesToolInputSchema = z.object({
	workspace: z.string().optional().describe('Workspace slug filter'),
});
export type ListTablesToolInput = z.infer<typeof ListTablesToolInputSchema>;

export const SearchGlobalToolInputSchema = z.object({
	query: z.string().describe('Search query'),
	limit: z.number().int().min(1).max(100).default(20).optional(),
});
export type SearchGlobalToolInput = z.infer<typeof SearchGlobalToolInputSchema>;

// ── Member & Permission Tool Inputs ──

export const UpdateMemberRoleToolInputSchema = z.object({
	userId: z.string().uuid(),
	roleId: z.string().uuid(),
});
export type UpdateMemberRoleToolInput = z.infer<typeof UpdateMemberRoleToolInputSchema>;

export const CreateRoleToolInputSchema = z.object({
	name: z.string(),
	permissions: z.record(z.unknown()),
});
export type CreateRoleToolInput = z.infer<typeof CreateRoleToolInputSchema>;

export const SetFieldAccessToolInputSchema = z.object({
	roleId: z.string().uuid(),
	workspace: z.string(),
	table: z.string(),
	hidden: z.array(z.string()).optional(),
	readOnly: z.array(z.string()).optional(),
});
export type SetFieldAccessToolInput = z.infer<typeof SetFieldAccessToolInputSchema>;

// ── Schema Suggestions Tool Inputs ──

export const ListSuggestionsToolInputSchema = z.object({});
export type ListSuggestionsToolInput = z.infer<typeof ListSuggestionsToolInputSchema>;

export const ApproveSuggestionToolInputSchema = z.object({
	suggestionId: z.string().uuid(),
	note: z.string().optional(),
});
export type ApproveSuggestionToolInput = z.infer<typeof ApproveSuggestionToolInputSchema>;

export const RejectSuggestionToolInputSchema = z.object({
	suggestionId: z.string().uuid(),
	note: z.string().optional(),
});
export type RejectSuggestionToolInput = z.infer<typeof RejectSuggestionToolInputSchema>;

// ── Automation Tool Inputs ──

export const CreateAutomationToolInputSchema = z.object({
	name: z.string(),
	workspace: z.string().optional(),
	trigger: z.record(z.unknown()),
	actions: z.array(z.record(z.unknown())),
});
export type CreateAutomationToolInput = z.infer<typeof CreateAutomationToolInputSchema>;

export const ListAutomationsToolInputSchema = z.object({
	workspace: z.string().optional(),
});
export type ListAutomationsToolInput = z.infer<typeof ListAutomationsToolInputSchema>;

export const ToggleAutomationToolInputSchema = z.object({
	automationId: z.string().uuid(),
	active: z.boolean(),
});
export type ToggleAutomationToolInput = z.infer<typeof ToggleAutomationToolInputSchema>;

// ── Audit & Monitoring Tool Inputs ──

export const GetAgentActivityToolInputSchema = z.object({
	agentId: z.string(),
	limit: z.number().int().min(1).max(100).default(20).optional(),
});
export type GetAgentActivityToolInput = z.infer<typeof GetAgentActivityToolInputSchema>;

export const GetProvenanceToolInputSchema = z.object({
	recordId: z.string().uuid(),
	field: z.string().optional(),
});
export type GetProvenanceToolInput = z.infer<typeof GetProvenanceToolInputSchema>;

// Resource URI types
export type McpResourceUri =
	| 'agentsync://schema/overview'
	| `agentsync://workspace/${string}/stats`
	| 'agentsync://instructions'
	| 'agentsync://blueprints/catalog';

// Prompt argument types
export const BuildBlueprintPromptArgsSchema = z.object({
	domain: z.string().describe('The business domain to build a blueprint for'),
});

export type BuildBlueprintPromptArgs = z.infer<typeof BuildBlueprintPromptArgsSchema>;

export const InvestigateRecordPromptArgsSchema = z.object({
	recordId: z.string().uuid(),
});

export type InvestigateRecordPromptArgs = z.infer<typeof InvestigateRecordPromptArgsSchema>;

export const DataQualityCheckPromptArgsSchema = z.object({
	workspace: z.string().describe('Workspace slug to check'),
});

export type DataQualityCheckPromptArgs = z.infer<typeof DataQualityCheckPromptArgsSchema>;

export const OnboardMemberPromptArgsSchema = z.object({
	memberEmail: z.string().email(),
	role: z.string(),
});

export type OnboardMemberPromptArgs = z.infer<typeof OnboardMemberPromptArgsSchema>;

export const MigrateDataPromptArgsSchema = z.object({
	sourceTool: z.string().describe('Name of the legacy tool'),
	targetTable: z.string().describe('Table slug to migrate into'),
	fieldMapping: z.record(z.string()).optional().describe('Source field → target field mapping'),
});

export type MigrateDataPromptArgs = z.infer<typeof MigrateDataPromptArgsSchema>;
