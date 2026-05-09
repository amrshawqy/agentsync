import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DataService } from '../../src/services/data/data.service.js';
import { ProvenanceService } from '../../src/services/data/provenance.service.js';
import {
	createMockAuditService,
	createMockConstraintService,
	createMockDb,
	createMockEventService,
	createMockIndexService,
	createMockPermissionService,
	createMockRelationService,
	createMockSchemaService,
	createMockSearchService,
	createTestContext,
} from './setup.js';

describe('DataService Integration', () => {
	let db: ReturnType<typeof createMockDb>;
	let provenance: ProvenanceService;
	let schemaService: ReturnType<typeof createMockSchemaService>;
	let permissionService: ReturnType<typeof createMockPermissionService>;
	let constraintService: ReturnType<typeof createMockConstraintService>;
	let eventService: ReturnType<typeof createMockEventService>;
	let auditService: ReturnType<typeof createMockAuditService>;
	let indexService: ReturnType<typeof createMockIndexService>;
	let relationService: ReturnType<typeof createMockRelationService>;
	let searchService: ReturnType<typeof createMockSearchService>;
	let service: DataService;
	let ctx: ReturnType<typeof createTestContext>;

	beforeEach(() => {
		db = createMockDb();
		provenance = new ProvenanceService();
		schemaService = createMockSchemaService();
		permissionService = createMockPermissionService();
		constraintService = createMockConstraintService();
		eventService = createMockEventService();
		auditService = createMockAuditService();
		indexService = createMockIndexService();
		relationService = createMockRelationService();
		searchService = createMockSearchService();
		ctx = createTestContext();

		service = new DataService(
			db,
			provenance,
			indexService,
			relationService,
			searchService,
			constraintService,
			permissionService,
			schemaService,
			eventService,
			auditService,
		);
	});

	describe('createRecord', () => {
		it('creates a record with provenance and emits event with scope metadata', async () => {
			const mockRecord = {
				id: 'rec-1',
				teamId: 'team-1',
				tableId: 'table-1',
				data: { name: 'John', email: 'john@test.com' },
				provenance: {},
				createdAt: new Date(),
				updatedAt: new Date(),
			};
			db._mock.setInsertResult([mockRecord]);

			const result = await service.createRecord(ctx, {
				tableId: 'table-1',
				data: { name: 'John', email: 'john@test.com' },
			});

			expect(result.id).toBe('rec-1');
			expect(permissionService.evaluate).toHaveBeenCalledWith(
				expect.objectContaining({ action: 'create' }),
			);
			expect(constraintService.validate).toHaveBeenCalled();
			expect(indexService.updateIndexes).toHaveBeenCalled();
			expect(eventService.emit).toHaveBeenCalledWith(
				expect.objectContaining({
					eventType: 'record.created',
					tableId: 'table-1',
					table: 'contacts',
					workspaceId: 'ws-1',
					workspace: 'sales',
				}),
			);
		});

		it('passes custom confidence to provenance', async () => {
			const mockRecord = {
				id: 'rec-1',
				teamId: 'team-1',
				tableId: 'table-1',
				data: { name: 'Maybe John' },
				provenance: {},
				createdAt: new Date(),
				updatedAt: new Date(),
			};
			db._mock.setInsertResult([mockRecord]);

			const buildSpy = vi.spyOn(provenance, 'buildProvenance');

			await service.createRecord(ctx, {
				tableId: 'table-1',
				data: { name: 'Maybe John' },
				confidence: 0.6,
			});

			expect(buildSpy).toHaveBeenCalledWith({ name: 'Maybe John' }, 'user-1', 0.6);
		});

		it('throws on permission denied', async () => {
			permissionService.evaluate.mockResolvedValueOnce({
				allowed: false,
				layer: 2,
				reason: 'No workspace access',
			});

			await expect(
				service.createRecord(ctx, { tableId: 'table-1', data: { name: 'Test' } }),
			).rejects.toThrow('Permission denied');
		});

		it('throws on constraint violation', async () => {
			constraintService.validate.mockResolvedValueOnce([
				{ code: 'REQUIRED_FIELD_MISSING', field: 'email', message: 'email is required' },
			]);

			await expect(service.createRecord(ctx, { tableId: 'table-1', data: {} })).rejects.toThrow(
				'Validation failed',
			);
		});
	});

	describe('getRecord', () => {
		it('returns record with relations and applies field filtering', async () => {
			const mockRecord = {
				id: 'rec-1',
				teamId: 'team-1',
				tableId: 'table-1',
				data: { name: 'John', ssn: '123-45-6789' },
				provenance: {
					name: { agent: 'a', at: 'now', confidence: 1 },
					ssn: { agent: 'a', at: 'now', confidence: 1 },
				},
			};

			// Mock getRecord DB select
			db.select.mockReturnValueOnce({
				from: vi.fn(() => ({
					where: vi.fn(() => [mockRecord]),
				})),
			});

			permissionService.evaluate.mockResolvedValueOnce({
				allowed: true,
				layer: 6,
				reason: 'Permitted',
				fieldAccess: { hidden: ['ssn'], readOnly: [] },
			});

			const result = await service.getRecord(ctx, 'rec-1');

			expect(result).not.toBeNull();
			expect((result?.data as any).name).toBe('John');
			expect((result?.data as any).ssn).toBeUndefined();
			expect((result?.provenance as any).ssn).toBeUndefined();
		});
	});

	describe('updateRecord', () => {
		it('updates record and passes confidence to mergeProvenance', async () => {
			const existing = {
				id: 'rec-1',
				teamId: 'team-1',
				tableId: 'table-1',
				data: { name: 'John' },
				provenance: { name: { agent: 'a', at: 'now', confidence: 1 } },
			};

			db.select.mockReturnValueOnce({
				from: vi.fn(() => ({
					where: vi.fn(() => [existing]),
				})),
			});

			const updatedRecord = { ...existing, data: { name: 'Jane' } };
			db._mock.setUpdateResult([updatedRecord]);

			const mergeSpy = vi.spyOn(provenance, 'mergeProvenance');

			await service.updateRecord(ctx, 'rec-1', {
				data: { name: 'Jane' },
				confidence: 0.8,
			});

			expect(mergeSpy).toHaveBeenCalledWith(existing.provenance, { name: 'Jane' }, 'user-1', 0.8);
			expect(eventService.emit).toHaveBeenCalledWith(
				expect.objectContaining({
					eventType: 'record.updated',
					tableId: 'table-1',
					table: 'contacts',
					workspaceId: 'ws-1',
					workspace: 'sales',
				}),
			);
		});
	});

	describe('deleteRecord', () => {
		it('soft deletes and emits event with scope metadata', async () => {
			const existing = {
				id: 'rec-1',
				teamId: 'team-1',
				tableId: 'table-1',
				data: { name: 'John' },
			};

			db.select.mockReturnValueOnce({
				from: vi.fn(() => ({
					where: vi.fn(() => [existing]),
				})),
			});

			db._mock.setUpdateResult([{ ...existing, deletedAt: new Date() }]);

			await service.deleteRecord(ctx, 'rec-1');

			expect(indexService.deleteIndexes).toHaveBeenCalledWith('rec-1');
			expect(eventService.emit).toHaveBeenCalledWith(
				expect.objectContaining({
					eventType: 'record.deleted',
					tableId: 'table-1',
					table: 'contacts',
					workspaceId: 'ws-1',
					workspace: 'sales',
				}),
			);
		});
	});

	describe('bulkImport', () => {
		it('emits individual record.created events for each imported record', async () => {
			const records = [
				{ id: 'rec-1', data: { name: 'A' } },
				{ id: 'rec-2', data: { name: 'B' } },
				{ id: 'rec-3', data: { name: 'C' } },
			];
			db._mock.setInsertResult([records[0]]);

			// Mock transaction to handle all inserts
			let callCount = 0;
			db.transaction.mockImplementation(async (fn: any) => {
				const txDb = {
					insert: vi.fn(() => ({
						values: vi.fn(() => ({
							returning: vi.fn(() => {
								const rec = records[callCount];
								callCount++;
								return [rec];
							}),
						})),
					})),
				};
				return fn(txDb);
			});

			await service.bulkImport(ctx, 'table-1', [{ name: 'A' }, { name: 'B' }, { name: 'C' }]);

			// Should emit record.created for each record
			expect(eventService.emit).toHaveBeenCalledTimes(3);
			expect(eventService.emit).toHaveBeenCalledWith(
				expect.objectContaining({
					eventType: 'record.created',
					tableId: 'table-1',
					table: 'contacts',
					workspaceId: 'ws-1',
					workspace: 'sales',
				}),
			);
		});
	});
});
