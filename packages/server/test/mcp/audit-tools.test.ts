import { beforeAll, describe, expect, it } from 'vitest';
import { registerTools } from '../../src/mcp/tools/index.js';
import {
	createAuthContextGetter,
	createMockMcpServer,
	createMockServiceContainer,
	getResultJson,
	getResultText,
} from './setup.js';

describe('Audit & Monitoring MCP tools', () => {
	const mcp = createMockMcpServer();
	const services = createMockServiceContainer();
	const getAuth = createAuthContextGetter();

	beforeAll(() => {
		registerTools(mcp as any, services as any, getAuth);
	});

	// ── query_audit_log ──

	describe('query_audit_log', () => {
		it('should return audit log entries', async () => {
			services.audit.query.mockResolvedValueOnce({
				data: [{ id: 'log-1', action: 'create', resourceType: 'record', resourceId: 'rec-1' }],
				total: 1,
				limit: 20,
				offset: 0,
				hasMore: false,
			});

			const result = await mcp.invokeTool('query_audit_log', {});
			const json = getResultJson(result) as any;

			expect(json.data).toHaveLength(1);
			expect(json.data[0]).toMatchObject({ action: 'create', resourceType: 'record' });
			expect(services.audit.query).toHaveBeenCalledWith(
				expect.objectContaining({ teamId: 'team-test-1' }),
			);
		});

		it('should pass filter parameters to the audit query', async () => {
			services.audit.query.mockResolvedValueOnce({
				data: [],
				total: 0,
				limit: 10,
				offset: 0,
				hasMore: false,
			});

			await mcp.invokeTool('query_audit_log', {
				resourceType: 'record',
				action: 'delete',
				limit: 10,
			});

			expect(services.audit.query).toHaveBeenCalledWith({
				teamId: 'team-test-1',
				resourceType: 'record',
				action: 'delete',
				limit: 10,
			});
		});

		it('should support filtering by resourceId', async () => {
			services.audit.query.mockResolvedValueOnce({
				data: [{ id: 'log-2', action: 'update', resourceId: 'rec-42' }],
				total: 1,
				limit: 20,
				offset: 0,
				hasMore: false,
			});

			const result = await mcp.invokeTool('query_audit_log', {
				resourceId: 'rec-42',
			});
			const json = getResultJson(result) as any;

			expect(json.data[0].resourceId).toBe('rec-42');
			expect(services.audit.query).toHaveBeenCalledWith(
				expect.objectContaining({ resourceId: 'rec-42' }),
			);
		});
	});

	// ── get_agent_activity ──

	describe('get_agent_activity', () => {
		it('should query audit log scoped to a specific agent', async () => {
			services.audit.query.mockResolvedValueOnce({
				data: [
					{ id: 'log-a1', action: 'create', userId: 'agent-abc' },
					{ id: 'log-a2', action: 'update', userId: 'agent-abc' },
				],
				total: 2,
				limit: 20,
				offset: 0,
				hasMore: false,
			});

			const result = await mcp.invokeTool('get_agent_activity', {
				agentId: 'agent-abc',
			});
			const json = getResultJson(result) as any;

			expect(json.data).toHaveLength(2);
			expect(services.audit.query).toHaveBeenCalledWith({
				teamId: 'team-test-1',
				userId: 'agent-abc',
				limit: 20,
			});
		});

		it('should respect custom limit', async () => {
			services.audit.query.mockResolvedValueOnce({
				data: [],
				total: 0,
				limit: 5,
				offset: 0,
				hasMore: false,
			});

			await mcp.invokeTool('get_agent_activity', {
				agentId: 'agent-xyz',
				limit: 5,
			});

			expect(services.audit.query).toHaveBeenCalledWith({
				teamId: 'team-test-1',
				userId: 'agent-xyz',
				limit: 5,
			});
		});
	});

	// ── get_provenance ──

	describe('get_provenance', () => {
		it('should return full provenance for a record', async () => {
			const provenance = {
				email: { agent: 'agent-1', at: '2025-01-01T00:00:00Z', confidence: 0.95 },
				name: { agent: 'agent-2', at: '2025-01-02T00:00:00Z', confidence: 1 },
			};
			services.data.getRecord.mockResolvedValueOnce({
				id: 'rec-1',
				data: { email: 'a@b.com', name: 'Alice' },
				provenance,
			});

			const recordId = '00000000-0000-0000-0000-000000000099';
			const result = await mcp.invokeTool('get_provenance', { recordId });
			const json = getResultJson(result) as any;

			expect(json).toHaveProperty('email');
			expect(json).toHaveProperty('name');
			expect(json.email.confidence).toBe(0.95);
		});

		it('should return field-specific provenance when field is specified', async () => {
			const provenance = {
				email: { agent: 'agent-1', at: '2025-01-01T00:00:00Z', confidence: 0.95 },
				name: { agent: 'agent-2', at: '2025-01-02T00:00:00Z', confidence: 1 },
			};
			services.data.getRecord.mockResolvedValueOnce({
				id: 'rec-1',
				data: { email: 'a@b.com', name: 'Alice' },
				provenance,
			});

			const recordId = '00000000-0000-0000-0000-000000000099';
			const result = await mcp.invokeTool('get_provenance', { recordId, field: 'email' });
			const json = getResultJson(result) as any;

			expect(Object.keys(json)).toEqual(['email']);
			expect(json.email.confidence).toBe(0.95);
		});

		it('should return error when record is not found', async () => {
			services.data.getRecord.mockResolvedValueOnce(null);

			const recordId = '00000000-0000-0000-0000-000000000000';
			const result = await mcp.invokeTool('get_provenance', { recordId });

			expect(result.isError).toBe(true);
			expect(getResultText(result)).toBe('Record not found');
		});
	});
});
