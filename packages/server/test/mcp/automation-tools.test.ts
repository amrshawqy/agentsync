import { describe, it, expect, beforeAll } from 'vitest';
import { registerTools } from '../../src/mcp/tools/index.js';
import {
	createMockMcpServer,
	createMockServiceContainer,
	createAuthContextGetter,
	getResultText,
	getResultJson,
} from './setup.js';

describe('Automation MCP tools', () => {
	const mcp = createMockMcpServer();
	const services = createMockServiceContainer();
	const getAuth = createAuthContextGetter();

	beforeAll(() => {
		registerTools(mcp as any, services as any, getAuth);
	});

	// ── create_automation ──

	describe('create_automation', () => {
		it('should create an automation without workspace', async () => {
			const trigger = { event: 'record.created', table: 'contacts' };
			const actions = [{ type: 'notify', channel: 'slack' }];
			services.automation.create.mockResolvedValueOnce({
				id: 'auto-1',
				name: 'New Lead Alert',
				isActive: true,
				trigger,
				actions,
			});

			const result = await mcp.invokeTool('create_automation', {
				name: 'New Lead Alert',
				trigger,
				actions,
			});
			const json = getResultJson(result) as any;

			expect(json).toMatchObject({ id: 'auto-1', name: 'New Lead Alert', isActive: true });
			expect(services.automation.create).toHaveBeenCalledWith(
				'team-test-1',
				'user-test-1',
				expect.objectContaining({
					name: 'New Lead Alert',
					workspaceId: undefined,
					trigger,
					actions,
				}),
			);
		});

		it('should create an automation scoped to a workspace', async () => {
			services.schema.getWorkspaceBySlug.mockResolvedValueOnce({
				id: 'ws-crm',
				slug: 'crm',
				name: 'CRM',
			});
			services.automation.create.mockResolvedValueOnce({
				id: 'auto-2',
				name: 'CRM Auto',
				isActive: true,
				workspaceId: 'ws-crm',
			});

			const result = await mcp.invokeTool('create_automation', {
				name: 'CRM Auto',
				workspace: 'crm',
				trigger: { event: 'record.updated' },
				actions: [{ type: 'log' }],
			});
			const json = getResultJson(result) as any;

			expect(json.workspaceId).toBe('ws-crm');
			expect(services.schema.getWorkspaceBySlug).toHaveBeenCalledWith('team-test-1', 'crm');
			expect(services.automation.create).toHaveBeenCalledWith(
				'team-test-1',
				'user-test-1',
				expect.objectContaining({ workspaceId: 'ws-crm' }),
			);
		});
	});

	// ── list_automations ──

	describe('list_automations', () => {
		it('should list all automations without filter', async () => {
			services.automation.list.mockResolvedValueOnce([
				{ id: 'auto-1', name: 'Auto A', isActive: true },
				{ id: 'auto-2', name: 'Auto B', isActive: false },
			]);

			const result = await mcp.invokeTool('list_automations', {});
			const json = getResultJson(result) as any[];

			expect(json).toHaveLength(2);
			expect(services.automation.list).toHaveBeenCalledWith('team-test-1', undefined);
		});

		it('should filter automations by workspace', async () => {
			services.schema.getWorkspaceBySlug.mockResolvedValueOnce({
				id: 'ws-crm',
				slug: 'crm',
				name: 'CRM',
			});
			services.automation.list.mockResolvedValueOnce([
				{ id: 'auto-1', name: 'CRM Auto', isActive: true, workspaceId: 'ws-crm' },
			]);

			const result = await mcp.invokeTool('list_automations', { workspace: 'crm' });
			const json = getResultJson(result) as any[];

			expect(json).toHaveLength(1);
			expect(json[0].workspaceId).toBe('ws-crm');
			expect(services.automation.list).toHaveBeenCalledWith('team-test-1', 'ws-crm');
		});
	});

	// ── toggle_automation ──

	describe('toggle_automation', () => {
		it('should enable an automation', async () => {
			const automationId = '00000000-0000-0000-0000-000000000050';
			services.automation.toggle.mockResolvedValueOnce({
				id: automationId,
				name: 'My Automation',
				isActive: true,
			});

			const result = await mcp.invokeTool('toggle_automation', {
				automationId,
				active: true,
			});
			const text = getResultText(result);

			expect(text).toContain('enabled');
			expect(text).toContain('My Automation');
			expect(services.automation.toggle).toHaveBeenCalledWith(
				automationId,
				'team-test-1',
				true,
			);
		});

		it('should disable an automation', async () => {
			const automationId = '00000000-0000-0000-0000-000000000051';
			services.automation.toggle.mockResolvedValueOnce({
				id: automationId,
				name: 'Another Automation',
				isActive: false,
			});

			const result = await mcp.invokeTool('toggle_automation', {
				automationId,
				active: false,
			});
			const text = getResultText(result);

			expect(text).toContain('disabled');
			expect(text).toContain('Another Automation');
			expect(services.automation.toggle).toHaveBeenCalledWith(
				automationId,
				'team-test-1',
				false,
			);
		});
	});
});
