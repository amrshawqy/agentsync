import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ServiceContainer } from '../../services/index.js';

export function registerPrompts(mcp: McpServer, services: ServiceContainer) {
	mcp.prompt(
		'build_blueprint',
		'Step-by-step guide to design and deploy a Blueprint for a business domain',
		{ domain: z.string().describe('The business domain (e.g., "restaurant management")') },
		async (args) => {
			return {
				messages: [
					{
						role: 'user',
						content: {
							type: 'text',
							text: [
								`Help me build a Blueprint for: ${args.domain}`,
								'',
								'Follow these steps:',
								'1. Ask me about the key entities (tables) in this domain',
								'2. For each table, help define fields with proper types, validation, and agent_hints',
								'3. Define relationships between tables',
								'4. Set up state machine constraints where applicable',
								'5. Write business rule instructions',
								'6. Generate seed data for testing',
								'7. Deploy the blueprint using deploy_blueprint',
								'',
								'Start by asking me about the main entities in my ' + args.domain + ' workflow.',
							].join('\n'),
						},
					},
				],
			};
		},
	);

	mcp.prompt(
		'investigate_record',
		'Deep dive into a record: history, provenance, relations, and data quality',
		{ recordId: z.string().uuid().describe('The record ID to investigate') },
		async (args) => {
			return {
				messages: [
					{
						role: 'user',
						content: {
							type: 'text',
							text: [
								`Investigate record: ${args.recordId}`,
								'',
								'Please:',
								'1. Fetch the record with get_record',
								'2. Show all field values and their provenance (who set each field, when, confidence)',
								'3. List all relations (traverse)',
								'4. Check the audit log for this record',
								'5. Flag any low-confidence fields or unverified data',
								'6. Suggest verification actions if needed',
							].join('\n'),
						},
					},
				],
			};
		},
	);

	mcp.prompt(
		'data_quality_check',
		'Scan a workspace for data quality issues',
		{ workspace: z.string().describe('Workspace slug to check') },
		async (args) => {
			return {
				messages: [
					{
						role: 'user',
						content: {
							type: 'text',
							text: [
								`Run a data quality check on workspace: ${args.workspace}`,
								'',
								'Please:',
								'1. Use describe_table for each table to understand the schema',
								'2. Query records and check for:',
								'   - Missing required fields',
								'   - Low-confidence provenance entries',
								'   - Unverified fields that should be verified',
								'   - Records with no relations (orphans)',
								'   - Fields with suspicious patterns (duplicates, empty strings)',
								'3. Produce a summary report with counts and specific examples',
								'4. Suggest corrective actions',
							].join('\n'),
						},
					},
				],
			};
		},
	);

	mcp.prompt(
		'onboard_member',
		'Set up a new team member with proper role, permissions, and instructions',
		{
			memberEmail: z.string().email().describe('Email of the new member'),
			role: z.string().describe('Role name for the member'),
		},
		async (args) => {
			return {
				messages: [
					{
						role: 'user',
						content: {
							type: 'text',
							text: [
								`Onboard new member: ${args.memberEmail} as ${args.role}`,
								'',
								'Please:',
								'1. Add the member using add_member',
								'2. List available roles and assign the appropriate one',
								'3. Review the current instructions for this role',
								'4. Suggest any role-specific instructions or guardrails to add',
								'5. Generate an Agent Kit for their preferred platform',
								'6. Provide a summary of what they can access and do',
							].join('\n'),
						},
					},
				],
			};
		},
	);

	mcp.prompt(
		'migrate_data',
		'Plan and execute migration from a legacy tool',
		{
			sourceTool: z.string().describe('Name of the legacy tool'),
			targetTable: z.string().describe('Target table slug'),
			fieldMapping: z.string().optional().describe('JSON field mapping (source → target)'),
		},
		async (args) => {
			return {
				messages: [
					{
						role: 'user',
						content: {
							type: 'text',
							text: [
								`Migrate data from ${args.sourceTool} to table: ${args.targetTable}`,
								args.fieldMapping ? `Field mapping: ${args.fieldMapping}` : '',
								'',
								'Please:',
								'1. Describe the target table schema using describe_table',
								'2. Help map source fields to target fields',
								'3. Validate the mapping covers required fields',
								'4. Plan the import in batches using bulk_import',
								'5. Set provenance to indicate data source and confidence',
								'6. Run a data quality check after import',
							].join('\n'),
						},
					},
				],
			};
		},
	);
}
