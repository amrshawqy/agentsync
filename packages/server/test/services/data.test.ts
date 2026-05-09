import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DataService } from '../../src/services/data/data.service.js';

function createMockDeps() {
	const mockRecord = {
		id: 'rec-1',
		teamId: 'team-1',
		tableId: 'table-1',
		data: { name: 'Test', email: 'test@example.com' },
		provenance: { name: { agent: 'user-1', at: new Date().toISOString(), confidence: 1 } },
		createdBy: 'user-1',
		updatedBy: 'user-1',
		createdAt: new Date(),
		updatedAt: new Date(),
		deletedAt: null,
	};

	const db = {
		transaction: vi.fn(async (fn: any) =>
			fn({
				insert: vi.fn().mockReturnValue({
					values: vi.fn().mockReturnValue({
						returning: vi.fn().mockResolvedValue([mockRecord]),
						onConflictDoUpdate: vi.fn().mockReturnThis(),
					}),
				}),
				update: vi.fn().mockReturnValue({
					set: vi.fn().mockReturnValue({
						where: vi.fn().mockReturnValue({
							returning: vi.fn().mockResolvedValue([mockRecord]),
						}),
					}),
				}),
				delete: vi.fn().mockReturnValue({
					where: vi.fn().mockResolvedValue(undefined),
				}),
			}),
		),
		select: vi.fn().mockReturnValue({
			from: vi.fn().mockReturnValue({
				where: vi.fn().mockResolvedValue([mockRecord]),
				orderBy: vi.fn().mockReturnValue({
					limit: vi.fn().mockReturnValue({
						offset: vi.fn().mockResolvedValue([mockRecord]),
					}),
				}),
			}),
		}),
		update: vi.fn().mockReturnValue({
			set: vi.fn().mockReturnValue({
				where: vi.fn().mockReturnValue({
					returning: vi.fn().mockResolvedValue([mockRecord]),
				}),
			}),
		}),
	} as any;

	const provenance = {
		buildProvenance: vi
			.fn()
			.mockReturnValue({ name: { agent: 'user-1', at: new Date().toISOString(), confidence: 1 } }),
		mergeProvenance: vi
			.fn()
			.mockReturnValue({ name: { agent: 'user-1', at: new Date().toISOString(), confidence: 1 } }),
		addVerification: vi.fn().mockReturnValue({}),
	} as any;

	const indexService = {
		updateIndexes: vi.fn().mockResolvedValue(undefined),
		deleteIndexes: vi.fn().mockResolvedValue(undefined),
	} as any;

	const relation = {
		link: vi.fn().mockResolvedValue({}),
		getRelationsForRecord: vi.fn().mockResolvedValue([]),
	} as any;

	const search = {
		search: vi.fn().mockResolvedValue(['rec-1']),
		fullTextSearch: vi.fn().mockResolvedValue([]),
	} as any;

	const constraint = {
		validate: vi.fn().mockResolvedValue([]),
	} as any;

	const permission = {
		evaluate: vi
			.fn()
			.mockResolvedValue({ allowed: true, fieldAccess: { hidden: [], readOnly: [] } }),
	} as any;

	const schema = {
		getTableById: vi
			.fn()
			.mockResolvedValue({ id: 'table-1', slug: 'contacts', workspaceId: 'ws-1' }),
		getWorkspaceById: vi.fn().mockResolvedValue({ id: 'ws-1', slug: 'crm' }),
		getFieldsForTable: vi.fn().mockResolvedValue([]),
	} as any;

	const event = {
		emit: vi.fn().mockResolvedValue(undefined),
	} as any;

	const audit = {
		log: vi.fn().mockResolvedValue(undefined),
	} as any;

	return {
		db,
		provenance,
		indexService,
		relation,
		search,
		constraint,
		permission,
		schema,
		event,
		audit,
		mockRecord,
	};
}

const ctx = {
	teamId: 'team-1',
	userId: 'user-1',
	roleId: 'role-1',
	permissions: {},
};

describe('DataService', () => {
	it('createRecord validates constraints and returns record', async () => {
		const deps = createMockDeps();
		const service = new DataService(
			deps.db,
			deps.provenance,
			deps.indexService,
			deps.relation,
			deps.search,
			deps.constraint,
			deps.permission,
			deps.schema,
			deps.event,
			deps.audit,
		);

		const result = await service.createRecord(ctx, {
			tableId: 'table-1',
			data: { name: 'Test' },
		});

		expect(deps.constraint.validate).toHaveBeenCalledWith('table-1', { name: 'Test' });
		expect(result).toBeDefined();
		expect(result.id).toBe('rec-1');
	});

	it('createRecord throws on constraint violations', async () => {
		const deps = createMockDeps();
		deps.constraint.validate.mockResolvedValue([
			{
				field: 'name',
				code: 'REQUIRED_FIELD_MISSING',
				message: 'Field is required',
			},
		]);

		const service = new DataService(
			deps.db,
			deps.provenance,
			deps.indexService,
			deps.relation,
			deps.search,
			deps.constraint,
			deps.permission,
			deps.schema,
			deps.event,
			deps.audit,
		);

		await expect(
			service.createRecord(ctx, {
				tableId: 'table-1',
				data: {},
			}),
		).rejects.toThrow('Validation failed');
	});

	it('createRecord emits event and logs audit', async () => {
		const deps = createMockDeps();
		const service = new DataService(
			deps.db,
			deps.provenance,
			deps.indexService,
			deps.relation,
			deps.search,
			deps.constraint,
			deps.permission,
			deps.schema,
			deps.event,
			deps.audit,
		);

		await service.createRecord(ctx, {
			tableId: 'table-1',
			data: { name: 'Test' },
		});

		expect(deps.event.emit).toHaveBeenCalledWith(
			expect.objectContaining({
				eventType: 'record.created',
				teamId: 'team-1',
				tableId: 'table-1',
				table: 'contacts',
				workspaceId: 'ws-1',
				workspace: 'crm',
			}),
		);
		expect(deps.audit.log).toHaveBeenCalled();
	});

	it('createRecord creates relations when links are provided', async () => {
		const deps = createMockDeps();
		const service = new DataService(
			deps.db,
			deps.provenance,
			deps.indexService,
			deps.relation,
			deps.search,
			deps.constraint,
			deps.permission,
			deps.schema,
			deps.event,
			deps.audit,
		);

		await service.createRecord(ctx, {
			tableId: 'table-1',
			data: { name: 'Test' },
			links: [{ targetRecordId: 'rec-2', relationType: 'belongs_to' }],
		});

		expect(deps.relation.link).toHaveBeenCalled();
	});

	it('getRecord returns null for nonexistent record', async () => {
		const deps = createMockDeps();
		deps.db.select.mockReturnValue({
			from: vi.fn().mockReturnValue({
				where: vi.fn().mockResolvedValue([]),
			}),
		});

		const service = new DataService(
			deps.db,
			deps.provenance,
			deps.indexService,
			deps.relation,
			deps.search,
			deps.constraint,
			deps.permission,
			deps.schema,
			deps.event,
			deps.audit,
		);

		const result = await service.getRecord(ctx, 'nonexistent');
		expect(result).toBeNull();
	});

	it('getRecord includes relations in result', async () => {
		const deps = createMockDeps();
		deps.relation.getRelationsForRecord.mockResolvedValue([
			{ sourceRecordId: 'rec-1', targetRecordId: 'rec-2', relationType: 'belongs_to' },
		]);

		const service = new DataService(
			deps.db,
			deps.provenance,
			deps.indexService,
			deps.relation,
			deps.search,
			deps.constraint,
			deps.permission,
			deps.schema,
			deps.event,
			deps.audit,
		);

		const result = await service.getRecord(ctx, 'rec-1');
		expect(result).not.toBeNull();
		expect(result?.relations).toHaveLength(1);
	});

	it('updateRecord merges data and provenance', async () => {
		const deps = createMockDeps();
		const service = new DataService(
			deps.db,
			deps.provenance,
			deps.indexService,
			deps.relation,
			deps.search,
			deps.constraint,
			deps.permission,
			deps.schema,
			deps.event,
			deps.audit,
		);

		const result = await service.updateRecord(ctx, 'rec-1', {
			data: { name: 'Updated' },
		});

		expect(deps.provenance.mergeProvenance).toHaveBeenCalled();
		expect(result).toBeDefined();
	});

	it('deleteRecord soft deletes and cleans indexes', async () => {
		const deps = createMockDeps();
		const service = new DataService(
			deps.db,
			deps.provenance,
			deps.indexService,
			deps.relation,
			deps.search,
			deps.constraint,
			deps.permission,
			deps.schema,
			deps.event,
			deps.audit,
		);

		await service.deleteRecord(ctx, 'rec-1');

		expect(deps.indexService.deleteIndexes).toHaveBeenCalledWith('rec-1');
		expect(deps.event.emit).toHaveBeenCalledWith(
			expect.objectContaining({
				eventType: 'record.deleted',
				tableId: 'table-1',
				table: 'contacts',
				workspaceId: 'ws-1',
				workspace: 'crm',
			}),
		);
	});

	it('queryRecords returns paginated results', async () => {
		const deps = createMockDeps();
		// Mock count query
		const selectMock = vi
			.fn()
			.mockReturnValueOnce({
				from: vi.fn().mockReturnValue({
					where: vi.fn().mockResolvedValue([{ count: 1 }]),
				}),
			})
			.mockReturnValue({
				from: vi.fn().mockReturnValue({
					where: vi.fn().mockReturnValue({
						orderBy: vi.fn().mockReturnValue({
							limit: vi.fn().mockReturnValue({
								offset: vi.fn().mockResolvedValue([deps.mockRecord]),
							}),
						}),
					}),
				}),
			});
		deps.db.select = selectMock;

		const service = new DataService(
			deps.db,
			deps.provenance,
			deps.indexService,
			deps.relation,
			deps.search,
			deps.constraint,
			deps.permission,
			deps.schema,
			deps.event,
			deps.audit,
		);

		const result = await service.queryRecords(ctx, {
			tableId: 'table-1',
			limit: 50,
			offset: 0,
		});

		expect(result).toHaveProperty('data');
		expect(result).toHaveProperty('total');
		expect(result).toHaveProperty('hasMore');
	});

	it('bulkImport creates multiple records in transaction', async () => {
		const deps = createMockDeps();
		const service = new DataService(
			deps.db,
			deps.provenance,
			deps.indexService,
			deps.relation,
			deps.search,
			deps.constraint,
			deps.permission,
			deps.schema,
			deps.event,
			deps.audit,
		);

		const items = [{ name: 'Record 1' }, { name: 'Record 2' }];

		const result = await service.bulkImport(ctx, 'table-1', items);
		expect(result).toHaveLength(2);
		expect(deps.constraint.validate).toHaveBeenCalledTimes(2);
	});

	it('verifyField updates provenance with verification', async () => {
		const deps = createMockDeps();
		const service = new DataService(
			deps.db,
			deps.provenance,
			deps.indexService,
			deps.relation,
			deps.search,
			deps.constraint,
			deps.permission,
			deps.schema,
			deps.event,
			deps.audit,
		);

		await service.verifyField(ctx, 'rec-1', 'email', 'dns-check', 'valid');

		expect(deps.provenance.addVerification).toHaveBeenCalledWith(
			expect.anything(),
			'email',
			expect.objectContaining({ method: 'dns-check', outcome: 'valid' }),
		);
		expect(deps.event.emit).toHaveBeenCalledWith(
			expect.objectContaining({
				eventType: 'field.changed',
				tableId: 'table-1',
				table: 'contacts',
				workspaceId: 'ws-1',
				workspace: 'crm',
			}),
		);
	});
});
