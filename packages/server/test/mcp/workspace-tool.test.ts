import { describe, it, expect, beforeAll } from 'vitest';
import { registerTools } from '../../src/mcp/tools/index.js';
import {
	createMockMcpServer,
	createMockServiceContainer,
	createAuthContextGetter,
	getResultText,
	getResultJson,
} from './setup.js';

describe('Agent Kit MCP tools', () => {
	const mcp = createMockMcpServer();
	const services = createMockServiceContainer();
	const getAuth = createAuthContextGetter();

	beforeAll(() => {
		registerTools(mcp as any, services as any, getAuth);
	});

	// ── get_agent_kit ──

	describe('get_agent_kit', () => {
		it('should generate a kit for claude-code format', async () => {
			services.agentKit.generate.mockResolvedValueOnce({
				format: 'claude-code',
				config: { mcpServers: { agentsync: { command: 'npx', args: ['agentsync-mcp'] } } },
			});

			const result = await mcp.invokeTool('get_agent_kit', { format: 'claude-code' });
			const json = getResultJson(result) as any;

			expect(json.format).toBe('claude-code');
			expect(json.config).toBeDefined();
			expect(services.agentKit.generate).toHaveBeenCalledWith(
				'team-test-1',
				'user-test-1',
				'claude-code',
			);
		});

		it('should generate a kit for claude-desktop format', async () => {
			services.agentKit.generate.mockResolvedValueOnce({
				format: 'claude-desktop',
				config: { mcpServers: {} },
			});

			const result = await mcp.invokeTool('get_agent_kit', { format: 'claude-desktop' });
			const json = getResultJson(result) as any;

			expect(json.format).toBe('claude-desktop');
			expect(services.agentKit.generate).toHaveBeenCalledWith(
				'team-test-1',
				'user-test-1',
				'claude-desktop',
			);
		});

		it('should generate a kit for cursor format', async () => {
			services.agentKit.generate.mockResolvedValueOnce({
				format: 'cursor',
				config: { rules: [] },
			});

			const result = await mcp.invokeTool('get_agent_kit', { format: 'cursor' });
			const json = getResultJson(result) as any;

			expect(json.format).toBe('cursor');
			expect(services.agentKit.generate).toHaveBeenCalledWith(
				'team-test-1',
				'user-test-1',
				'cursor',
			);
		});

		it('should generate a kit for a specific member', async () => {
			const memberId = '00000000-0000-0000-0000-000000000070';
			services.agentKit.generate.mockResolvedValueOnce({
				format: 'raw',
				config: { tools: [], instructions: '' },
			});

			const result = await mcp.invokeTool('get_agent_kit', {
				format: 'raw',
				memberId,
			});
			const json = getResultJson(result) as any;

			expect(json.format).toBe('raw');
			expect(services.agentKit.generate).toHaveBeenCalledWith(
				'team-test-1',
				memberId,
				'raw',
			);
		});
	});
});
