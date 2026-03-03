import { describe, it, expect, beforeAll } from 'vitest';
import { registerTools } from '../../src/mcp/tools/index.js';
import {
	createMockMcpServer,
	createMockServiceContainer,
	createAuthContextGetter,
	getResultText,
	getResultJson,
} from './setup.js';

describe('Event Tools', () => {
	let server: ReturnType<typeof createMockMcpServer>;
	let services: ReturnType<typeof createMockServiceContainer>;

	beforeAll(() => {
		server = createMockMcpServer();
		services = createMockServiceContainer();
		registerTools(server as any, services as any, createAuthContextGetter());
	});

	// ── subscribe_events ──

	describe('subscribe_events', () => {
		it('should subscribe to events successfully', async () => {
			services.event.subscribe.mockResolvedValueOnce({
				id: 'sub-100',
				eventType: 'record.created',
				callbackType: 'sse',
				isActive: true,
			});

			const result = await server.invokeTool('subscribe_events', {
				eventType: 'record.created',
			});

			expect(result.isError).toBeUndefined();
			const json = getResultJson(result) as any;
			expect(json.id).toBe('sub-100');
			expect(json.eventType).toBe('record.created');
			expect(json.callbackType).toBe('sse');
			expect(json.isActive).toBe(true);

			expect(services.event.subscribe).toHaveBeenCalledWith(
				'team-test-1',
				'user-test-1',
				expect.objectContaining({
					eventType: 'record.created',
					callbackType: 'sse',
					tableId: undefined,
				}),
			);
		});

		it('should subscribe with a table filter', async () => {
			services.schema.findTableBySlug.mockResolvedValueOnce({
				id: 'tbl-99',
				slug: 'contacts',
				name: 'Contacts',
			});
			services.event.subscribe.mockResolvedValueOnce({
				id: 'sub-101',
				eventType: 'record.updated',
				callbackType: 'sse',
				isActive: true,
				tableId: 'tbl-99',
			});

			const result = await server.invokeTool('subscribe_events', {
				eventType: 'record.updated',
				table: 'contacts',
			});

			expect(result.isError).toBeUndefined();
			const json = getResultJson(result) as any;
			expect(json.id).toBe('sub-101');
			expect(json.tableId).toBe('tbl-99');

			expect(services.event.subscribe).toHaveBeenCalledWith(
				'team-test-1',
				'user-test-1',
				expect.objectContaining({
					eventType: 'record.updated',
					callbackType: 'sse',
					tableId: 'tbl-99',
				}),
			);
		});

		it('should pass condition when provided', async () => {
			services.event.subscribe.mockResolvedValueOnce({
				id: 'sub-102',
				eventType: 'record.created',
				callbackType: 'sse',
				isActive: true,
			});

			const condition = { field: 'status', value: 'active' };
			await server.invokeTool('subscribe_events', {
				eventType: 'record.created',
				condition,
			});

			expect(services.event.subscribe).toHaveBeenCalledWith(
				'team-test-1',
				'user-test-1',
				expect.objectContaining({
					condition,
				}),
			);
		});
	});

	// ── unsubscribe_events ──

	describe('unsubscribe_events', () => {
		it('should unsubscribe successfully', async () => {
			services.event.unsubscribe.mockResolvedValueOnce(true);

			const subId = '550e8400-e29b-41d4-a716-446655440000';
			const result = await server.invokeTool('unsubscribe_events', {
				subscriptionId: subId,
			});

			expect(result.isError).toBeUndefined();
			expect(getResultText(result)).toBe('Unsubscribed.');
			expect(services.event.unsubscribe).toHaveBeenCalledWith(subId, 'team-test-1');
		});
	});

	// ── list_subscriptions ──

	describe('list_subscriptions', () => {
		it('should list subscriptions (activeOnly default true)', async () => {
			const mockSubs = [
				{ id: 'sub-1', eventType: 'record.created', isActive: true },
				{ id: 'sub-2', eventType: 'record.updated', isActive: true },
			];
			services.event.listSubscriptions.mockResolvedValueOnce(mockSubs);

			const result = await server.invokeTool('list_subscriptions', {});

			expect(result.isError).toBeUndefined();
			const json = getResultJson(result) as any[];
			expect(json).toHaveLength(2);
			expect(json[0].id).toBe('sub-1');
			expect(json[1].id).toBe('sub-2');

			expect(services.event.listSubscriptions).toHaveBeenCalledWith(
				'team-test-1',
				'user-test-1',
				true,
			);
		});

		it('should pass activeOnly=false when specified', async () => {
			services.event.listSubscriptions.mockResolvedValueOnce([
				{ id: 'sub-1', eventType: 'record.created', isActive: true },
				{ id: 'sub-3', eventType: 'record.deleted', isActive: false },
			]);

			const result = await server.invokeTool('list_subscriptions', {
				activeOnly: false,
			});

			expect(result.isError).toBeUndefined();
			const json = getResultJson(result) as any[];
			expect(json).toHaveLength(2);

			expect(services.event.listSubscriptions).toHaveBeenCalledWith(
				'team-test-1',
				'user-test-1',
				false,
			);
		});

		it('should return empty array when no subscriptions exist', async () => {
			services.event.listSubscriptions.mockResolvedValueOnce([]);

			const result = await server.invokeTool('list_subscriptions', {});

			expect(result.isError).toBeUndefined();
			const json = getResultJson(result) as any[];
			expect(json).toEqual([]);
		});
	});
});
