import type { EventPayload } from '@agentsync/types';
import { describe, expect, it, vi } from 'vitest';
import { AutomationEngine } from '../../src/services/automation/automation-engine.js';
import { MarketplaceService } from '../../src/services/blueprint/marketplace.service.js';
import { EventService } from '../../src/services/event/event.service.js';
import { SSEManager } from '../../src/services/event/sse-manager.js';

describe('EventService', () => {
	it('filters webhook subscriptions by workspaceId', async () => {
		const mockDispatcher = { dispatch: vi.fn() };
		const mockSseManager = { broadcast: vi.fn() };
		const mockWebhookSender = { send: vi.fn().mockResolvedValue(true) };
		const mockDb = {
			insert: vi.fn(),
			select: vi.fn(() => ({
				from: vi.fn(() => ({
					where: vi.fn(() => [
						{
							id: 'sub-1',
							workspaceId: 'ws-1',
							tableId: null,
							callbackType: 'webhook',
							callbackUrl: 'https://example.com/hook',
							condition: null,
							isActive: true,
						},
						{
							id: 'sub-2',
							workspaceId: 'ws-2',
							tableId: null,
							callbackType: 'webhook',
							callbackUrl: 'https://example.com/hook2',
							condition: null,
							isActive: true,
						},
					]),
				})),
			})),
		};

		const eventService = new EventService(
			mockDb as any,
			mockDispatcher as any,
			mockSseManager as any,
			mockWebhookSender as any,
		);

		await eventService.emit({
			eventType: 'record.created',
			teamId: 'team-1',
			workspaceId: 'ws-1',
			data: {},
		});

		// Only sub-1 should match (ws-1), sub-2 should be filtered out (ws-2 !== ws-1)
		expect(mockWebhookSender.send).toHaveBeenCalledTimes(1);
		expect(mockWebhookSender.send).toHaveBeenCalledWith(
			'https://example.com/hook',
			expect.objectContaining({ eventType: 'record.created' }),
		);
	});

	it('filters webhook subscriptions by tableId', async () => {
		const mockDispatcher = { dispatch: vi.fn() };
		const mockSseManager = { broadcast: vi.fn() };
		const mockWebhookSender = { send: vi.fn().mockResolvedValue(true) };
		const mockDb = {
			select: vi.fn(() => ({
				from: vi.fn(() => ({
					where: vi.fn(() => [
						{
							id: 'sub-1',
							workspaceId: null,
							tableId: 'table-1',
							callbackType: 'webhook',
							callbackUrl: 'https://example.com/hook',
							condition: null,
							isActive: true,
						},
					]),
				})),
			})),
		};

		const eventService = new EventService(
			mockDb as any,
			mockDispatcher as any,
			mockSseManager as any,
			mockWebhookSender as any,
		);

		await eventService.emit({
			eventType: 'record.created',
			teamId: 'team-1',
			tableId: 'table-2', // Different table!
			data: {},
		});

		// Should NOT call webhook — tableId mismatch
		expect(mockWebhookSender.send).not.toHaveBeenCalled();
	});
});

describe('SSEManager', () => {
	it('includes event ID in SSE message format', () => {
		const manager = new SSEManager();
		const chunks: string[] = [];
		const mockController = {
			enqueue: vi.fn((data: Uint8Array) => {
				chunks.push(new TextDecoder().decode(data));
			}),
		};

		manager.addConnection('conn-1', 'user-1', 'team-1', [], mockController as any);

		const event: EventPayload = {
			eventId: 'evt-123',
			eventType: 'record.created',
			timestamp: new Date().toISOString(),
			teamId: 'team-1',
			data: { name: 'John' },
		};

		manager.broadcast(event);

		expect(chunks.length).toBe(1);
		expect(chunks[0]).toContain('id: evt-123');
		expect(chunks[0]).toContain('data: ');
	});
});

describe('AutomationEngine', () => {
	it('matchesTrigger checks eventType', () => {
		const engine = new AutomationEngine({} as any, {} as any, {} as any, {} as any);

		const event: EventPayload = {
			eventId: 'evt-1',
			eventType: 'record.created',
			timestamp: new Date().toISOString(),
			teamId: 'team-1',
			table: 'contacts',
			data: {},
		};

		expect(engine.matchesTrigger({ eventType: 'record.created' }, event)).toBe(true);
		expect(engine.matchesTrigger({ eventType: 'record.deleted' }, event)).toBe(false);
	});

	it('matchesTrigger checks table', () => {
		const engine = new AutomationEngine({} as any, {} as any, {} as any, {} as any);

		const event: EventPayload = {
			eventId: 'evt-1',
			eventType: 'record.created',
			timestamp: new Date().toISOString(),
			teamId: 'team-1',
			table: 'contacts',
			data: {},
		};

		expect(engine.matchesTrigger({ table: 'contacts' }, event)).toBe(true);
		expect(engine.matchesTrigger({ table: 'companies' }, event)).toBe(false);
	});

	it('matchesTrigger checks condition', () => {
		const engine = new AutomationEngine({} as any, {} as any, {} as any, {} as any);

		const event: EventPayload = {
			eventId: 'evt-1',
			eventType: 'record.created',
			timestamp: new Date().toISOString(),
			teamId: 'team-1',
			data: { status: 'active', priority: 'high' },
		};

		expect(engine.matchesTrigger({ condition: { status: 'active' } }, event)).toBe(true);
		expect(engine.matchesTrigger({ condition: { status: 'inactive' } }, event)).toBe(false);
	});

	it('matchesTrigger returns true for empty trigger', () => {
		const engine = new AutomationEngine({} as any, {} as any, {} as any, {} as any);

		const event: EventPayload = {
			eventId: 'evt-1',
			eventType: 'record.created',
			timestamp: new Date().toISOString(),
			teamId: 'team-1',
			data: {},
		};

		expect(engine.matchesTrigger({}, event)).toBe(true);
	});

	it('processEvent fires actions for matching automations', async () => {
		const mockFetch = vi.fn().mockResolvedValue({ ok: true });
		vi.stubGlobal('fetch', mockFetch);

		const mockAutomationService = {
			list: vi.fn().mockResolvedValue([
				{
					id: 'auto-1',
					isActive: true,
					trigger: { eventType: 'record.created' },
					actions: [{ type: 'webhook', url: 'https://example.com/auto' }],
				},
				{
					id: 'auto-2',
					isActive: false,
					trigger: { eventType: 'record.created' },
					actions: [{ type: 'webhook', url: 'https://example.com/inactive' }],
				},
			]),
		};

		const engine = new AutomationEngine(
			{} as any,
			mockAutomationService as any,
			{} as any,
			{} as any,
		);

		await engine.processEvent({
			eventId: 'evt-1',
			eventType: 'record.created',
			timestamp: new Date().toISOString(),
			teamId: 'team-1',
			data: {},
		});

		// Only auto-1 is active — should fire one webhook
		expect(mockFetch).toHaveBeenCalledTimes(1);
		expect(mockFetch).toHaveBeenCalledWith(
			'https://example.com/auto',
			expect.objectContaining({ method: 'POST' }),
		);

		vi.unstubAllGlobals();
	});
});
