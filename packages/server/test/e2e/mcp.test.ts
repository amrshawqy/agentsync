import { describe, expect, it, vi } from 'vitest';
import { AgentKitService } from '../../src/services/agent-kit/agent-kit.service.js';
import { ProvenanceService } from '../../src/services/data/provenance.service.js';

describe('MCP Tool behaviors', () => {
	describe('create_record with confidence', () => {
		it('ProvenanceService passes confidence through to entries', () => {
			const service = new ProvenanceService();
			const result = service.buildProvenance(
				{ name: 'John', email: 'j@test.com' },
				'scraper-agent',
				0.65,
			);

			expect(result.name.confidence).toBe(0.65);
			expect(result.email.confidence).toBe(0.65);
			expect(result.name.agent).toBe('scraper-agent');
		});
	});

	describe('update_record with confidence', () => {
		it('mergeProvenance passes confidence for updated fields only', () => {
			const service = new ProvenanceService();
			const existing = service.buildProvenance(
				{ name: 'John', email: 'j@test.com' },
				'agent-1',
				0.9,
			);
			const merged = service.mergeProvenance(existing, { email: 'john@new.com' }, 'agent-2', 0.7);

			expect(merged.name.confidence).toBe(0.9); // unchanged
			expect(merged.name.agent).toBe('agent-1');
			expect(merged.email.confidence).toBe(0.7); // updated
			expect(merged.email.agent).toBe('agent-2');
		});
	});

	describe('query_records with sort', () => {
		it('sort parameter is defined in QueryRecords schema', async () => {
			const { QueryRecordsSchema } = await import('@agentsync/types');
			const parsed = QueryRecordsSchema.parse({
				tableId: '550e8400-e29b-41d4-a716-446655440000',
				sort: [
					{ field: 'name', direction: 'asc' },
					{ field: 'createdAt', direction: 'desc' },
				],
			});

			expect(parsed.sort).toHaveLength(2);
			expect(parsed.sort?.[0].field).toBe('name');
			expect(parsed.sort?.[0].direction).toBe('asc');
			expect(parsed.sort?.[1].direction).toBe('desc');
		});
	});

	describe('EventPayload includes workspaceId and tableId', () => {
		it('EventPayload schema accepts workspaceId and tableId', async () => {
			const { EventPayloadSchema } = await import('@agentsync/types');
			const parsed = EventPayloadSchema.parse({
				eventId: 'evt-1',
				eventType: 'record.created',
				timestamp: new Date().toISOString(),
				teamId: '550e8400-e29b-41d4-a716-446655440000',
				workspaceId: '550e8400-e29b-41d4-a716-446655440001',
				tableId: '550e8400-e29b-41d4-a716-446655440002',
				data: {},
			});

			expect(parsed.workspaceId).toBe('550e8400-e29b-41d4-a716-446655440001');
			expect(parsed.tableId).toBe('550e8400-e29b-41d4-a716-446655440002');
		});
	});

	describe('CreateRecord schema includes confidence', () => {
		it('CreateRecordSchema accepts optional confidence', async () => {
			const { CreateRecordSchema } = await import('@agentsync/types');
			const parsed = CreateRecordSchema.parse({
				tableId: '550e8400-e29b-41d4-a716-446655440000',
				data: { name: 'Test' },
				confidence: 0.75,
			});

			expect(parsed.confidence).toBe(0.75);
		});

		it('CreateRecordSchema allows omitting confidence', async () => {
			const { CreateRecordSchema } = await import('@agentsync/types');
			const parsed = CreateRecordSchema.parse({
				tableId: '550e8400-e29b-41d4-a716-446655440000',
				data: { name: 'Test' },
			});

			expect(parsed.confidence).toBeUndefined();
		});
	});

	describe('MCP tool schemas include confidence', () => {
		it('CreateRecordToolInputSchema has confidence field', async () => {
			const { CreateRecordToolInputSchema } = await import('@agentsync/types');
			const parsed = CreateRecordToolInputSchema.parse({
				table: 'contacts',
				data: { name: 'Test' },
				confidence: 0.8,
			});

			expect(parsed.confidence).toBe(0.8);
		});

		it('UpdateRecordToolInputSchema has confidence field', async () => {
			const { UpdateRecordToolInputSchema } = await import('@agentsync/types');
			const parsed = UpdateRecordToolInputSchema.parse({
				recordId: '550e8400-e29b-41d4-a716-446655440000',
				updates: { name: 'Updated' },
				confidence: 0.9,
			});

			expect(parsed.confidence).toBe(0.9);
		});
	});

	describe('GetAgentKitToolInputSchema accepts memberId', () => {
		it('memberId is optional on the schema', async () => {
			const { GetAgentKitToolInputSchema } = await import('@agentsync/types');
			const parsed = GetAgentKitToolInputSchema.parse({
				format: 'claude-desktop',
				memberId: '550e8400-e29b-41d4-a716-446655440000',
			});

			expect(parsed.memberId).toBe('550e8400-e29b-41d4-a716-446655440000');
		});

		it('memberId can be omitted', async () => {
			const { GetAgentKitToolInputSchema } = await import('@agentsync/types');
			const parsed = GetAgentKitToolInputSchema.parse({
				format: 'raw',
			});

			expect(parsed.memberId).toBeUndefined();
		});
	});

	describe('EventType enum includes new event types', () => {
		it('includes relation and blueprint events', async () => {
			const { EventType } = await import('@agentsync/types');

			expect(EventType.parse('relation.added')).toBe('relation.added');
			expect(EventType.parse('relation.removed')).toBe('relation.removed');
			expect(EventType.parse('blueprint.deployed')).toBe('blueprint.deployed');
			expect(EventType.parse('blueprint.evolved')).toBe('blueprint.evolved');
		});
	});
});
