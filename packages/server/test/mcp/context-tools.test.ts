import { beforeAll, describe, expect, it } from 'vitest';
import { registerTools } from '../../src/mcp/tools/index.js';
import {
	createAuthContextGetter,
	createMockMcpServer,
	createMockServiceContainer,
	getResultJson,
	getResultText,
} from './setup.js';

describe('Context & Discovery MCP tools', () => {
	const mcp = createMockMcpServer();
	const services = createMockServiceContainer();
	const getAuth = createAuthContextGetter();

	beforeAll(() => {
		registerTools(mcp as any, services as any, getAuth);
	});

	// ── get_context ──

	describe('get_context', () => {
		it('should return assembled instructions for the current agent', async () => {
			services.instruction.assemble.mockResolvedValueOnce(
				'You are an AI agent working in the CRM workspace. Follow these rules...',
			);

			const result = await mcp.invokeTool('get_context', {});
			const text = getResultText(result);

			expect(text).toContain('You are an AI agent');
			expect(text).toContain('CRM workspace');
			expect(services.instruction.assemble).toHaveBeenCalledWith('team-test-1', 'role-test-1');
		});

		it('should use role from auth context', async () => {
			const customMcp = createMockMcpServer();
			const customServices = createMockServiceContainer();
			const customAuth = createAuthContextGetter({ roleId: 'role-admin' });
			registerTools(customMcp as any, customServices as any, customAuth);

			customServices.instruction.assemble.mockResolvedValueOnce('Admin context');

			await customMcp.invokeTool('get_context', {});

			expect(customServices.instruction.assemble).toHaveBeenCalledWith('team-test-1', 'role-admin');
		});
	});

	// ── list_workspaces ──

	describe('list_workspaces', () => {
		it('should return all workspaces for the team', async () => {
			services.schema.listWorkspaces.mockResolvedValueOnce([
				{ id: 'ws-1', slug: 'crm', name: 'CRM' },
				{ id: 'ws-2', slug: 'hr', name: 'Human Resources' },
				{ id: 'ws-3', slug: 'support', name: 'Support' },
			]);

			const result = await mcp.invokeTool('list_workspaces', {});
			const json = getResultJson(result) as any[];

			expect(json).toHaveLength(3);
			expect(json.map((ws: any) => ws.slug)).toEqual(['crm', 'hr', 'support']);
			expect(services.schema.listWorkspaces).toHaveBeenCalledWith('team-test-1');
		});

		it('should return empty array when no workspaces exist', async () => {
			services.schema.listWorkspaces.mockResolvedValueOnce([]);

			const result = await mcp.invokeTool('list_workspaces', {});
			const json = getResultJson(result) as any[];

			expect(json).toEqual([]);
		});
	});

	// ── search_global ──

	describe('search_global', () => {
		it('should search across all workspaces and tables', async () => {
			services.schema.getSchemaOverview.mockResolvedValueOnce([
				{
					workspace: { slug: 'crm', name: 'CRM' },
					tables: [{ slug: 'contacts', name: 'Contacts' }],
				},
			]);
			services.schema.findTableBySlug.mockResolvedValueOnce({
				id: 'tbl-contacts',
				slug: 'contacts',
			});
			services.search.fullTextSearch.mockResolvedValueOnce([
				{ id: 'rec-1', data: { name: 'Alice', email: 'alice@example.com' } },
			]);

			const result = await mcp.invokeTool('search_global', { query: 'alice' });
			const json = getResultJson(result) as any[];

			expect(json).toHaveLength(1);
			expect(json[0]).toMatchObject({
				id: 'rec-1',
				_workspace: 'crm',
				_table: 'contacts',
			});
			expect(services.search.fullTextSearch).toHaveBeenCalledWith(
				expect.objectContaining({
					teamId: 'team-test-1',
					tableId: 'tbl-contacts',
					query: 'alice',
				}),
			);
		});

		it('should respect the limit parameter', async () => {
			services.schema.getSchemaOverview.mockResolvedValueOnce([
				{
					workspace: { slug: 'crm', name: 'CRM' },
					tables: [{ slug: 'contacts', name: 'Contacts' }],
				},
			]);
			services.schema.findTableBySlug.mockResolvedValueOnce({
				id: 'tbl-contacts',
				slug: 'contacts',
			});
			services.search.fullTextSearch.mockResolvedValueOnce([]);

			await mcp.invokeTool('search_global', { query: 'test', limit: 5 });

			expect(services.search.fullTextSearch).toHaveBeenCalledWith(
				expect.objectContaining({ limit: 5 }),
			);
		});

		it('should return empty array when no matches found', async () => {
			services.schema.getSchemaOverview.mockResolvedValueOnce([
				{
					workspace: { slug: 'crm', name: 'CRM' },
					tables: [{ slug: 'contacts', name: 'Contacts' }],
				},
			]);
			services.schema.findTableBySlug.mockResolvedValueOnce({
				id: 'tbl-contacts',
				slug: 'contacts',
			});
			services.search.fullTextSearch.mockResolvedValueOnce([]);

			const result = await mcp.invokeTool('search_global', { query: 'nonexistent' });
			const json = getResultJson(result) as any[];

			expect(json).toEqual([]);
		});
	});
});
