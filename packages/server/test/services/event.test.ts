import { describe, expect, it, vi } from 'vitest';
import { EventService } from '../../src/services/event/event.service.js';

function createMockDeps(webhookSubs: any[] = []) {
	const mockSubscription = {
		id: 'sub-1',
		teamId: 'team-1',
		userId: 'user-1',
		eventType: 'record.created',
		callbackType: 'sse',
		isActive: true,
		createdAt: new Date(),
	};

	const db = {
		select: vi.fn().mockReturnValue({
			from: vi.fn().mockReturnValue({
				where: vi.fn().mockResolvedValue(webhookSubs),
			}),
		}),
		insert: vi.fn().mockReturnValue({
			values: vi.fn().mockReturnValue({
				returning: vi.fn().mockResolvedValue([mockSubscription]),
			}),
		}),
		update: vi.fn().mockReturnValue({
			set: vi.fn().mockReturnValue({
				where: vi.fn().mockReturnValue({
					returning: vi.fn().mockResolvedValue([{ ...mockSubscription, isActive: false }]),
				}),
			}),
		}),
	} as any;

	const dispatcher = {
		dispatch: vi.fn().mockResolvedValue('event-id-1'),
	} as any;

	const sseManager = {
		broadcast: vi.fn(),
	} as any;

	const webhookSender = {
		send: vi.fn().mockResolvedValue(true),
	} as any;

	return { db, dispatcher, sseManager, webhookSender, mockSubscription };
}

describe('EventService', () => {
	it('emit dispatches event to Redis stream', async () => {
		const deps = createMockDeps();
		const service = new EventService(deps.db, deps.dispatcher, deps.sseManager, deps.webhookSender);

		await service.emit({
			eventType: 'record.created',
			teamId: 'team-1',
			recordId: 'rec-1',
			data: { name: 'Test' },
		});

		expect(deps.dispatcher.dispatch).toHaveBeenCalledWith(
			expect.objectContaining({
				eventType: 'record.created',
				teamId: 'team-1',
			}),
		);
	});

	it('emit broadcasts to SSE connections', async () => {
		const deps = createMockDeps();
		const service = new EventService(deps.db, deps.dispatcher, deps.sseManager, deps.webhookSender);

		await service.emit({
			eventType: 'record.created',
			teamId: 'team-1',
			recordId: 'rec-1',
			data: { name: 'Test' },
		});

		expect(deps.sseManager.broadcast).toHaveBeenCalled();
	});

	it('emit sends to webhook subscribers with callbackUrl', async () => {
		const webhookSubs = [
			{
				id: 'sub-2',
				teamId: 'team-1',
				eventType: 'record.created',
				callbackType: 'webhook',
				callbackUrl: 'https://example.com/hook',
				isActive: true,
				workspaceId: null,
				tableId: null,
				condition: null,
			},
		];
		const deps = createMockDeps(webhookSubs);
		const service = new EventService(deps.db, deps.dispatcher, deps.sseManager, deps.webhookSender);

		await service.emit({
			eventType: 'record.created',
			teamId: 'team-1',
			recordId: 'rec-1',
			data: {},
		});

		expect(deps.webhookSender.send).toHaveBeenCalledWith(
			'https://example.com/hook',
			expect.objectContaining({ eventType: 'record.created' }),
		);
	});

	it('subscribe creates a new subscription', async () => {
		const deps = createMockDeps();
		const service = new EventService(deps.db, deps.dispatcher, deps.sseManager, deps.webhookSender);

		const result = await service.subscribe('team-1', 'user-1', {
			eventType: 'record.created' as any,
			callbackType: 'sse' as any,
		});

		expect(deps.db.insert).toHaveBeenCalled();
		expect(result).toBeDefined();
	});

	it('unsubscribe marks subscription as inactive', async () => {
		const deps = createMockDeps();
		const service = new EventService(deps.db, deps.dispatcher, deps.sseManager, deps.webhookSender);

		await service.unsubscribe('sub-1', 'team-1');

		expect(deps.db.update).toHaveBeenCalled();
	});

	it('listSubscriptions returns subscriptions from DB', async () => {
		const deps = createMockDeps();
		deps.db.select.mockReturnValue({
			from: vi.fn().mockReturnValue({
				where: vi.fn().mockResolvedValue([deps.mockSubscription]),
			}),
		});
		const service = new EventService(deps.db, deps.dispatcher, deps.sseManager, deps.webhookSender);

		const result = await service.listSubscriptions('team-1', 'user-1', true);

		expect(deps.db.select).toHaveBeenCalled();
		expect(result).toHaveLength(1);
	});

	it('emit does not send to webhooks when no matching subscriptions', async () => {
		const deps = createMockDeps([]); // No webhook subs
		const service = new EventService(deps.db, deps.dispatcher, deps.sseManager, deps.webhookSender);

		await service.emit({
			eventType: 'record.deleted',
			teamId: 'team-1',
			recordId: 'rec-1',
			data: {},
		});

		expect(deps.webhookSender.send).not.toHaveBeenCalled();
	});
});
