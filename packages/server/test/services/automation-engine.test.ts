import { describe, it, expect, vi } from 'vitest';
import { AutomationEngine } from '../../src/services/automation/automation-engine.js';

function createMockDeps() {
	const dispatcher = {
		readNewEvents: vi.fn().mockResolvedValue([]),
		acknowledge: vi.fn().mockResolvedValue(undefined),
	} as any;

	const automationService = {
		list: vi.fn().mockResolvedValue([]),
	} as any;

	const dataService = {
		createRecord: vi.fn().mockResolvedValue({ id: 'rec-new' }),
		updateRecord: vi.fn().mockResolvedValue({ id: 'rec-1' }),
	} as any;

	const eventService = {
		emit: vi.fn().mockResolvedValue(undefined),
	} as any;

	return { dispatcher, automationService, dataService, eventService };
}

describe('AutomationEngine', () => {
	it('matchesTrigger returns true when event matches', () => {
		const deps = createMockDeps();
		const engine = new AutomationEngine(deps.dispatcher, deps.automationService, deps.dataService, deps.eventService);

		const result = engine.matchesTrigger(
			{ eventType: 'record.created', table: 'contacts' },
			{ eventType: 'record.created', table: 'contacts', teamId: 'team-1', data: {} } as any,
		);

		expect(result).toBe(true);
	});

	it('matchesTrigger returns false on event type mismatch', () => {
		const deps = createMockDeps();
		const engine = new AutomationEngine(deps.dispatcher, deps.automationService, deps.dataService, deps.eventService);

		const result = engine.matchesTrigger(
			{ eventType: 'record.created' },
			{ eventType: 'record.deleted', teamId: 'team-1', data: {} } as any,
		);

		expect(result).toBe(false);
	});

	it('matchesTrigger checks condition against event data', () => {
		const deps = createMockDeps();
		const engine = new AutomationEngine(deps.dispatcher, deps.automationService, deps.dataService, deps.eventService);

		const result = engine.matchesTrigger(
			{ eventType: 'record.created', condition: { status: 'active' } },
			{ eventType: 'record.created', teamId: 'team-1', data: { status: 'active' } } as any,
		);

		expect(result).toBe(true);
	});

	it('processEvent executes webhook action for matching automation', async () => {
		const deps = createMockDeps();
		deps.automationService.list.mockResolvedValue([{
			id: 'auto-1',
			isActive: true,
			trigger: { eventType: 'record.created' },
			actions: [{ type: 'webhook', url: 'https://example.com/hook' }],
		}]);

		const engine = new AutomationEngine(deps.dispatcher, deps.automationService, deps.dataService, deps.eventService);

		// Mock fetch globally
		const mockFetch = vi.fn().mockResolvedValue({ ok: true });
		vi.stubGlobal('fetch', mockFetch);

		await engine.processEvent({
			eventId: 'evt-1',
			eventType: 'record.created',
			teamId: 'team-1',
			data: {},
		} as any);

		expect(mockFetch).toHaveBeenCalled();

		vi.unstubAllGlobals();
	});

	it('processEvent executes create_record action', async () => {
		const deps = createMockDeps();
		deps.automationService.list.mockResolvedValue([{
			id: 'auto-1',
			isActive: true,
			trigger: { eventType: 'record.created' },
			actions: [{ type: 'create_record', tableId: 'table-2', data: { note: 'auto-created' } }],
		}]);

		const engine = new AutomationEngine(deps.dispatcher, deps.automationService, deps.dataService, deps.eventService);

		await engine.processEvent({
			eventId: 'evt-1',
			eventType: 'record.created',
			teamId: 'team-1',
			data: {},
		} as any);

		expect(deps.dataService.createRecord).toHaveBeenCalledWith(
			expect.objectContaining({ teamId: 'team-1', agentId: 'automation-engine' }),
			expect.objectContaining({ tableId: 'table-2' }),
		);
	});

	it('processEvent skips inactive automations', async () => {
		const deps = createMockDeps();
		deps.automationService.list.mockResolvedValue([{
			id: 'auto-1',
			isActive: false,
			trigger: { eventType: 'record.created' },
			actions: [{ type: 'webhook', url: 'https://example.com/hook' }],
		}]);

		const engine = new AutomationEngine(deps.dispatcher, deps.automationService, deps.dataService, deps.eventService);

		const mockFetch = vi.fn();
		vi.stubGlobal('fetch', mockFetch);

		await engine.processEvent({
			eventId: 'evt-1',
			eventType: 'record.created',
			teamId: 'team-1',
			data: {},
		} as any);

		expect(mockFetch).not.toHaveBeenCalled();

		vi.unstubAllGlobals();
	});

	it('handles unknown action type gracefully', async () => {
		const deps = createMockDeps();
		deps.automationService.list.mockResolvedValue([{
			id: 'auto-1',
			isActive: true,
			trigger: { eventType: 'record.created' },
			actions: [{ type: 'unknown_action' }],
		}]);

		const engine = new AutomationEngine(deps.dispatcher, deps.automationService, deps.dataService, deps.eventService);

		// Should not throw
		await expect(engine.processEvent({
			eventId: 'evt-1',
			eventType: 'record.created',
			teamId: 'team-1',
			data: {},
		} as any)).resolves.toBeUndefined();
	});
});
