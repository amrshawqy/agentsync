import { describe, expect, it, vi } from 'vitest';
import { BlueprintService } from '../../src/services/blueprint/blueprint.service.js';

function createMockDeps() {
	const mockBlueprint = {
		id: 'bp-1',
		slug: 'crm',
		name: 'CRM',
		description: 'CRM blueprint',
		category: 'business',
		version: 1,
		isBuiltin: false,
		isPublished: false,
		installCount: 0,
		schemaDefinition: { tables: [] },
		seedData: null,
		instructions: null,
		marketplaceTags: [],
		createdByTeam: 'team-1',
		createdAt: new Date(),
		updatedAt: new Date(),
	};

	const db = {
		select: vi.fn().mockReturnValue({
			from: vi.fn().mockReturnValue({
				where: vi.fn().mockReturnValue({
					orderBy: vi.fn().mockResolvedValue([mockBlueprint]),
				}),
			}),
		}),
		insert: vi.fn().mockReturnValue({
			values: vi.fn().mockReturnValue({
				returning: vi.fn().mockResolvedValue([mockBlueprint]),
			}),
		}),
		update: vi.fn().mockReturnValue({
			set: vi.fn().mockReturnValue({
				where: vi.fn().mockReturnValue({
					returning: vi.fn().mockResolvedValue([{ ...mockBlueprint, isPublished: true }]),
				}),
			}),
		}),
		transaction: vi.fn(async (fn: any) =>
			fn({
				insert: vi.fn().mockReturnValue({
					values: vi.fn().mockReturnValue({
						returning: vi.fn().mockResolvedValue([{ id: 'ws-1', slug: 'crm', name: 'CRM' }]),
					}),
				}),
				update: vi.fn().mockReturnValue({
					set: vi.fn().mockReturnValue({
						where: vi.fn().mockResolvedValue(undefined),
					}),
				}),
			}),
		),
	} as any;

	const schemaService = {
		createTable: vi.fn().mockResolvedValue({ id: 'table-1' }),
		createField: vi.fn().mockResolvedValue({ id: 'field-1' }),
	} as any;

	const constraintService = {
		validate: vi.fn().mockResolvedValue([]),
	} as any;

	const provenanceService = {
		buildProvenance: vi.fn().mockReturnValue({}),
	} as any;

	return { db, schemaService, constraintService, provenanceService, mockBlueprint };
}

describe('BlueprintService', () => {
	it('create validates schema and inserts blueprint', async () => {
		const deps = createMockDeps();
		const service = new BlueprintService(
			deps.db,
			deps.schemaService,
			deps.constraintService,
			deps.provenanceService,
		);

		const result = await service.create(
			{
				slug: 'crm',
				name: 'CRM',
				schemaDefinition: { tables: [] },
			},
			'team-1',
		);

		expect(deps.db.insert).toHaveBeenCalled();
		expect(result).toBeDefined();
		expect(result.slug).toBe('crm');
	});

	it('create throws on invalid blueprint schema', async () => {
		const deps = createMockDeps();
		const service = new BlueprintService(
			deps.db,
			deps.schemaService,
			deps.constraintService,
			deps.provenanceService,
		);

		await expect(
			service.create({
				slug: 'bad',
				name: 'Bad',
				schemaDefinition: null as any,
			}),
		).rejects.toThrow();
	});

	it('getBySlug returns latest version', async () => {
		const deps = createMockDeps();
		const service = new BlueprintService(
			deps.db,
			deps.schemaService,
			deps.constraintService,
			deps.provenanceService,
		);

		const result = await service.getBySlug('crm');
		expect(result).toBeDefined();
		expect(result?.slug).toBe('crm');
	});

	it('evolve creates new version with incremented version number', async () => {
		const deps = createMockDeps();
		deps.db.insert.mockReturnValue({
			values: vi.fn().mockReturnValue({
				returning: vi.fn().mockResolvedValue([{ ...deps.mockBlueprint, version: 2 }]),
			}),
		});
		const service = new BlueprintService(
			deps.db,
			deps.schemaService,
			deps.constraintService,
			deps.provenanceService,
		);

		const result = await service.evolve('crm', { tables: [{ slug: 'new_table' }] });
		expect(result.version).toBe(2);
	});

	it('evolve throws for non-existent blueprint', async () => {
		const deps = createMockDeps();
		deps.db.select.mockReturnValue({
			from: vi.fn().mockReturnValue({
				where: vi.fn().mockReturnValue({
					orderBy: vi.fn().mockResolvedValue([]),
				}),
			}),
		});
		const service = new BlueprintService(
			deps.db,
			deps.schemaService,
			deps.constraintService,
			deps.provenanceService,
		);

		await expect(service.evolve('nonexistent', {})).rejects.toThrow('Blueprint not found');
	});

	it('publish sets isPublished to true', async () => {
		const deps = createMockDeps();
		const service = new BlueprintService(
			deps.db,
			deps.schemaService,
			deps.constraintService,
			deps.provenanceService,
		);

		const result = await service.publish('crm');
		expect(result.isPublished).toBe(true);
	});

	it('publish throws for non-existent blueprint', async () => {
		const deps = createMockDeps();
		deps.db.select.mockReturnValue({
			from: vi.fn().mockReturnValue({
				where: vi.fn().mockReturnValue({
					orderBy: vi.fn().mockResolvedValue([]),
				}),
			}),
		});
		const service = new BlueprintService(
			deps.db,
			deps.schemaService,
			deps.constraintService,
			deps.provenanceService,
		);

		await expect(service.publish('nonexistent')).rejects.toThrow('Blueprint not found');
	});

	it('deploy creates workspace and tables in transaction', async () => {
		const deps = createMockDeps();
		deps.mockBlueprint.schemaDefinition = {
			tables: [
				{
					slug: 'contacts',
					name: 'Contacts',
					fields: [{ slug: 'name', name: 'Name', fieldType: 'text' }],
				},
			],
		};
		const service = new BlueprintService(
			deps.db,
			deps.schemaService,
			deps.constraintService,
			deps.provenanceService,
		);

		const result = await service.deploy('team-1', 'crm', {
			workspaceName: 'My CRM',
			workspaceSlug: 'my-crm',
		});

		expect(deps.db.transaction).toHaveBeenCalled();
		expect(result).toBeDefined();
	});
});
