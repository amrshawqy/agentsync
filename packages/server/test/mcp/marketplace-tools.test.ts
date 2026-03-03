import { describe, it, expect, beforeAll } from 'vitest';
import { registerTools } from '../../src/mcp/tools/index.js';
import {
	createMockMcpServer,
	createMockServiceContainer,
	createAuthContextGetter,
	getResultText,
	getResultJson,
} from './setup.js';

describe('Marketplace MCP tools', () => {
	const mcp = createMockMcpServer();
	const services = createMockServiceContainer();
	const getAuth = createAuthContextGetter();

	beforeAll(() => {
		registerTools(mcp as any, services as any, getAuth);
	});

	// ── search_marketplace ──

	describe('search_marketplace', () => {
		it('should search blueprints with a query', async () => {
			services.marketplace.searchBlueprints.mockResolvedValueOnce({
				data: [
					{ id: 'bp-crm', slug: 'crm', name: 'CRM Blueprint', category: 'sales' },
				],
				total: 1,
			});

			const result = await mcp.invokeTool('search_marketplace', { query: 'crm' });
			const json = getResultJson(result) as any;

			expect(json.data).toHaveLength(1);
			expect(json.data[0]).toMatchObject({ slug: 'crm', category: 'sales' });
			expect(services.marketplace.searchBlueprints).toHaveBeenCalledWith(
				'crm',
				undefined,
				undefined,
				20,
				0,
			);
		});

		it('should pass category and tags filters', async () => {
			services.marketplace.searchBlueprints.mockResolvedValueOnce({
				data: [],
				total: 0,
			});

			await mcp.invokeTool('search_marketplace', {
				query: 'project',
				category: 'operations',
				tags: ['kanban', 'agile'],
				limit: 10,
				offset: 5,
			});

			expect(services.marketplace.searchBlueprints).toHaveBeenCalledWith(
				'project',
				'operations',
				['kanban', 'agile'],
				10,
				5,
			);
		});

		it('should search without a query', async () => {
			services.marketplace.searchBlueprints.mockResolvedValueOnce({
				data: [
					{ id: 'bp-1', slug: 'hr', name: 'HR', category: 'hr' },
					{ id: 'bp-2', slug: 'support', name: 'Support', category: 'support' },
				],
				total: 2,
			});

			const result = await mcp.invokeTool('search_marketplace', {});
			const json = getResultJson(result) as any;

			expect(json.total).toBe(2);
			expect(services.marketplace.searchBlueprints).toHaveBeenCalledWith(
				undefined,
				undefined,
				undefined,
				20,
				0,
			);
		});
	});

	// ── submit_blueprint_review ──

	describe('submit_blueprint_review', () => {
		it('should submit a review with rating and body', async () => {
			const blueprintId = '00000000-0000-0000-0000-000000000060';
			services.marketplace.submitReview.mockResolvedValueOnce({
				id: 'rev-1',
				blueprintId,
				rating: 5,
				title: 'Excellent',
				body: 'Works perfectly for our sales team.',
			});

			const result = await mcp.invokeTool('submit_blueprint_review', {
				blueprintId,
				rating: 5,
				title: 'Excellent',
				body: 'Works perfectly for our sales team.',
			});
			const json = getResultJson(result) as any;

			expect(json).toMatchObject({ id: 'rev-1', rating: 5, title: 'Excellent' });
			expect(services.marketplace.submitReview).toHaveBeenCalledWith(
				'team-test-1',
				'user-test-1',
				{
					blueprintId,
					rating: 5,
					title: 'Excellent',
					body: 'Works perfectly for our sales team.',
				},
			);
		});

		it('should submit a review with only rating', async () => {
			const blueprintId = '00000000-0000-0000-0000-000000000061';
			services.marketplace.submitReview.mockResolvedValueOnce({
				id: 'rev-2',
				blueprintId,
				rating: 3,
			});

			const result = await mcp.invokeTool('submit_blueprint_review', {
				blueprintId,
				rating: 3,
			});
			const json = getResultJson(result) as any;

			expect(json.rating).toBe(3);
			expect(services.marketplace.submitReview).toHaveBeenCalledWith(
				'team-test-1',
				'user-test-1',
				{
					blueprintId,
					rating: 3,
					title: undefined,
					body: undefined,
				},
			);
		});
	});
});
