import { describe, it, expect, beforeAll } from 'vitest';
import { registerTools } from '../../src/mcp/tools/index.js';
import {
	createMockMcpServer,
	createMockServiceContainer,
	createAuthContextGetter,
	getResultText,
	getResultJson,
} from './setup.js';

describe('MCP Schema Tools', () => {
	const mcp = createMockMcpServer();
	const services = createMockServiceContainer();

	beforeAll(() => {
		registerTools(mcp as any, services as any, createAuthContextGetter());
	});

	// ── describe_table ──

	describe('describe_table', () => {
		it('returns table schema with fields', async () => {
			services.schema.getFieldsForTable.mockResolvedValueOnce([
				{ id: 'fld-1', slug: 'name', fieldType: 'text' },
				{ id: 'fld-2', slug: 'email', fieldType: 'email' },
			]);

			const result = await mcp.invokeTool('describe_table', { table: 'contacts' });

			expect(result.isError).toBeFalsy();
			const json = getResultJson(result) as any;
			expect(json).toHaveProperty('id', 'tbl-1');
			expect(json).toHaveProperty('slug', 'contacts');
			expect(json).toHaveProperty('name', 'Contacts');
			expect(json.fields).toHaveLength(2);
			expect(json.fields[0]).toHaveProperty('slug', 'name');
			expect(json.fields[1]).toHaveProperty('fieldType', 'email');
			expect(services.schema.findTableBySlug).toHaveBeenCalledWith('team-test-1', 'contacts');
			expect(services.schema.getFieldsForTable).toHaveBeenCalledWith('tbl-1');
		});

		it('returns an error when the table is not found', async () => {
			services.schema.findTableBySlug.mockResolvedValueOnce(null);

			const result = await mcp.invokeTool('describe_table', { table: 'nonexistent' });

			expect(result.isError).toBe(true);
			expect(getResultText(result)).toContain("Table 'nonexistent' not found");
		});

		it('resolves table via workspace slug when provided', async () => {
			services.schema.getFieldsForTable.mockResolvedValueOnce([]);

			await mcp.invokeTool('describe_table', { table: 'contacts', workspace: 'crm' });

			expect(services.schema.getWorkspaceBySlug).toHaveBeenCalledWith('team-test-1', 'crm');
			expect(services.schema.getTableBySlug).toHaveBeenCalledWith('team-test-1', 'ws-1', 'contacts');
		});
	});

	// ── describe_schema ──

	describe('describe_schema', () => {
		it('returns the full schema overview', async () => {
			const result = await mcp.invokeTool('describe_schema', {});

			expect(result.isError).toBeFalsy();
			const json = getResultJson(result) as any;
			expect(Array.isArray(json)).toBe(true);
			expect(json[0]).toHaveProperty('workspace');
			expect(json[0].workspace).toHaveProperty('slug', 'crm');
			expect(json[0]).toHaveProperty('tables');
			expect(services.schema.getSchemaOverview).toHaveBeenCalledWith('team-test-1');
		});
	});

	// ── create_workspace ──

	describe('create_workspace', () => {
		it('creates a workspace directly', async () => {
			const result = await mcp.invokeTool('create_workspace', {
				name: 'New Workspace',
				slug: 'new-ws',
			});

			expect(result.isError).toBeFalsy();
			const json = getResultJson(result) as any;
			expect(json).toHaveProperty('id', 'ws-new');
			expect(json).toHaveProperty('slug', 'new-ws');
			expect(services.schema.createWorkspace).toHaveBeenCalledWith(
				'team-test-1',
				'New Workspace',
				'new-ws',
			);
		});

		it('deploys a blueprint when blueprintId is provided', async () => {
			const blueprintId = '00000000-0000-0000-0000-000000000010';
			const result = await mcp.invokeTool('create_workspace', {
				name: 'CRM Workspace',
				slug: 'crm-ws',
				blueprintId,
			});

			expect(result.isError).toBeFalsy();
			const json = getResultJson(result) as any;
			expect(json).toHaveProperty('slug', 'crm');
			expect(services.blueprint.getById).toHaveBeenCalledWith(blueprintId);
			expect(services.blueprint.deploy).toHaveBeenCalledWith(
				'team-test-1',
				'crm',
				expect.objectContaining({
					workspaceName: 'CRM Workspace',
					workspaceSlug: 'crm-ws',
				}),
			);
			// createWorkspace should NOT be called when using a blueprint
			expect(services.schema.createWorkspace).not.toHaveBeenCalledWith(
				'team-test-1',
				'CRM Workspace',
				'crm-ws',
			);
		});
	});

	// ── create_table ──

	describe('create_table', () => {
		it('creates a table in a workspace with fields', async () => {
			const result = await mcp.invokeTool('create_table', {
				workspace: 'crm',
				name: 'Deals',
				slug: 'deals',
				description: 'Sales deals',
				fields: [
					{ name: 'Title', slug: 'title', fieldType: 'text', isRequired: true },
					{ name: 'Amount', slug: 'amount', fieldType: 'number' },
				],
			});

			expect(result.isError).toBeFalsy();
			const json = getResultJson(result) as any;
			expect(json).toHaveProperty('id', 'tbl-new');
			expect(json).toHaveProperty('slug', 'new-table');
			expect(services.schema.getWorkspaceBySlug).toHaveBeenCalledWith('team-test-1', 'crm');
			expect(services.schema.createTable).toHaveBeenCalledWith(
				'team-test-1',
				expect.objectContaining({
					name: 'Deals',
					slug: 'deals',
					workspaceId: 'ws-1',
					description: 'Sales deals',
					sourceLayer: 'workspace',
				}),
			);
			// Fields should be created in order
			expect(services.schema.createField).toHaveBeenCalledTimes(2);
			expect(services.schema.createField).toHaveBeenCalledWith(
				'team-test-1',
				'tbl-new',
				expect.objectContaining({
					name: 'Title',
					slug: 'title',
					fieldType: 'text',
					isRequired: true,
					fieldOrder: 0,
				}),
			);
			expect(services.schema.createField).toHaveBeenCalledWith(
				'team-test-1',
				'tbl-new',
				expect.objectContaining({
					name: 'Amount',
					slug: 'amount',
					fieldType: 'number',
					fieldOrder: 1,
				}),
			);
		});

		it('creates a table without fields', async () => {
			const result = await mcp.invokeTool('create_table', {
				workspace: 'crm',
				name: 'Notes',
				slug: 'notes',
			});

			expect(result.isError).toBeFalsy();
			expect(services.schema.createTable).toHaveBeenCalledWith(
				'team-test-1',
				expect.objectContaining({
					name: 'Notes',
					slug: 'notes',
					workspaceId: 'ws-1',
				}),
			);
		});

		it('returns an error when the workspace is not found', async () => {
			services.schema.getWorkspaceBySlug.mockResolvedValueOnce(null);

			const result = await mcp.invokeTool('create_table', {
				workspace: 'nonexistent',
				name: 'Table',
				slug: 'table',
			});

			expect(result.isError).toBe(true);
			expect(getResultText(result)).toContain("Workspace 'nonexistent' not found");
		});
	});

	// ── alter_table ──

	describe('alter_table', () => {
		it('alters a table by adding, removing, and updating fields', async () => {
			const result = await mcp.invokeTool('alter_table', {
				table: 'contacts',
				addFields: [{ name: 'Phone', slug: 'phone', fieldType: 'text' }],
				removeFields: ['old_field'],
				updateFields: [{ slug: 'email', isRequired: true }],
			});

			expect(result.isError).toBeFalsy();
			const json = getResultJson(result) as any;
			expect(json).toHaveProperty('id', 'tbl-1');
			expect(services.schema.alterTable).toHaveBeenCalledWith(
				'team-test-1',
				'tbl-1',
				expect.objectContaining({
					addFields: [{ name: 'Phone', slug: 'phone', fieldType: 'text' }],
					removeFields: ['old_field'],
					updateFields: [{ slug: 'email', isRequired: true }],
				}),
			);
		});

		it('returns an error when the table is not found', async () => {
			services.schema.findTableBySlug.mockResolvedValueOnce(null);

			const result = await mcp.invokeTool('alter_table', {
				table: 'nonexistent',
				addFields: [{ name: 'Phone', slug: 'phone', fieldType: 'text' }],
			});

			expect(result.isError).toBe(true);
			expect(getResultText(result)).toContain("Table 'nonexistent' not found");
		});
	});

	// ── list_tables ──

	describe('list_tables', () => {
		it('lists all tables across workspaces', async () => {
			const result = await mcp.invokeTool('list_tables', {});

			expect(result.isError).toBeFalsy();
			const json = getResultJson(result) as any;
			expect(Array.isArray(json)).toBe(true);
			expect(json[0]).toHaveProperty('workspace', 'crm');
			expect(json[0]).toHaveProperty('slug', 'contacts');
			expect(services.schema.getSchemaOverview).toHaveBeenCalledWith('team-test-1');
		});

		it('filters tables by workspace slug', async () => {
			services.schema.getSchemaOverview.mockResolvedValueOnce([
				{
					workspace: { slug: 'crm', name: 'CRM' },
					tables: [{ slug: 'contacts', name: 'Contacts' }],
				},
				{
					workspace: { slug: 'hr', name: 'HR' },
					tables: [{ slug: 'employees', name: 'Employees' }],
				},
			]);

			const result = await mcp.invokeTool('list_tables', { workspace: 'crm' });

			expect(result.isError).toBeFalsy();
			const json = getResultJson(result) as any;
			expect(json).toHaveLength(1);
			expect(json[0]).toHaveProperty('workspace', 'crm');
			expect(json[0]).toHaveProperty('slug', 'contacts');
		});
	});

	// ── list_blueprints ──

	describe('list_blueprints', () => {
		it('lists all available blueprints', async () => {
			const result = await mcp.invokeTool('list_blueprints', {});

			expect(result.isError).toBeFalsy();
			const json = getResultJson(result) as any;
			expect(Array.isArray(json)).toBe(true);
			expect(json[0]).toHaveProperty('slug', 'crm');
			expect(json[0]).toHaveProperty('name', 'CRM');
			expect(json[0]).toHaveProperty('category', 'sales');
			expect(services.blueprint.listBuiltin).toHaveBeenCalled();
			expect(services.blueprint.listPublished).toHaveBeenCalled();
		});

		it('filters blueprints by category', async () => {
			services.blueprint.listBuiltin.mockResolvedValueOnce([
				{ id: 'bp-crm', slug: 'crm', name: 'CRM', category: 'sales', version: 1 },
				{ id: 'bp-hr', slug: 'hr', name: 'HR', category: 'operations', version: 1 },
			]);
			services.blueprint.listPublished.mockResolvedValueOnce([]);

			const result = await mcp.invokeTool('list_blueprints', { category: 'sales' });

			expect(result.isError).toBeFalsy();
			const json = getResultJson(result) as any;
			expect(json).toHaveLength(1);
			expect(json[0]).toHaveProperty('slug', 'crm');
			expect(json[0]).toHaveProperty('category', 'sales');
		});
	});
});
