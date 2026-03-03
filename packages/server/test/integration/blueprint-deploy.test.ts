import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BlueprintService } from '../../src/services/blueprint/blueprint.service.js';
import { ProvenanceService } from '../../src/services/data/provenance.service.js';
import { createMockSchemaService, createMockConstraintService } from './setup.js';

describe('BlueprintService deploy()', () => {
	let db: any;
	let schemaService: ReturnType<typeof createMockSchemaService>;
	let constraintService: ReturnType<typeof createMockConstraintService>;
	let provenanceService: ProvenanceService;
	let service: BlueprintService;

	const blueprint = {
		id: 'bp-1',
		slug: 'crm',
		name: 'CRM Blueprint',
		description: 'A CRM blueprint',
		version: 1,
		schemaDefinition: {
			tables: [
				{
					slug: 'companies',
					name: 'Companies',
					fields: [
						{ slug: 'name', name: 'Name', fieldType: 'text', isRequired: true },
						{ slug: 'website', name: 'Website', fieldType: 'url' },
					],
				},
				{
					slug: 'contacts',
					name: 'Contacts',
					fields: [
						{ slug: 'name', name: 'Name', fieldType: 'text', isRequired: true },
						{ slug: 'company_id', name: 'Company', fieldType: 'relation' },
					],
				},
			],
		},
		seedData: {
			companies: [
				{ name: 'Acme Corp', website: 'https://acme.com' },
			],
			contacts: [
				{ name: 'John Doe', company_id: '@ref:companies:0' },
			],
		},
	};

	beforeEach(() => {
		provenanceService = new ProvenanceService();
		schemaService = createMockSchemaService();
		constraintService = createMockConstraintService();

		let tableCounter = 0;
		schemaService.createTable.mockImplementation(async () => {
			tableCounter++;
			return { id: `table-${tableCounter}`, slug: tableCounter === 1 ? 'companies' : 'contacts' };
		});

		let recordCounter = 0;
		const insertReturns: any[] = [];
		const updateCalls: any[] = [];

		db = {
			select: vi.fn(() => ({
				from: vi.fn(() => ({
					where: vi.fn(() => ({
						orderBy: vi.fn(() => [blueprint]),
					})),
				})),
			})),
			insert: vi.fn(() => ({
				values: vi.fn((vals: any) => ({
					returning: vi.fn(() => {
						recordCounter++;
						const rec = {
							id: `rec-${recordCounter}`,
							...vals,
						};
						insertReturns.push(rec);
						return [rec];
					}),
				})),
			})),
			update: vi.fn(() => ({
				set: vi.fn((vals: any) => {
					updateCalls.push(vals);
					return {
						where: vi.fn(),
					};
				}),
			})),
			transaction: vi.fn(async (fn: any) => fn(db)),
			_insertReturns: insertReturns,
			_updateCalls: updateCalls,
		};

		service = new BlueprintService(db, schemaService, constraintService, provenanceService);
	});

	it('wraps deploy in a transaction', async () => {
		await service.deploy('team-1', 'crm', { includeSeedData: true });
		expect(db.transaction).toHaveBeenCalled();
	});

	it('creates tables and fields for each table in the schema', async () => {
		await service.deploy('team-1', 'crm', { includeSeedData: false });

		expect(schemaService.createTable).toHaveBeenCalledTimes(2);
		// 2 fields for companies + 2 fields for contacts = 4
		expect(schemaService.createField).toHaveBeenCalledTimes(4);
	});

	it('validates seed data constraints before insertion', async () => {
		await service.deploy('team-1', 'crm', { includeSeedData: true });

		// Constraint validate called once per seed record (2 total: 1 company + 1 contact)
		expect(constraintService.validate).toHaveBeenCalledTimes(2);
	});

	it('throws on constraint validation failure in seed data', async () => {
		constraintService.validate.mockResolvedValueOnce([]).mockResolvedValueOnce([
			{ code: 'REQUIRED_FIELD_MISSING', field: 'name', message: 'name is required' },
		]);

		await expect(
			service.deploy('team-1', 'crm', { includeSeedData: true }),
		).rejects.toThrow('Seed data validation failed');
	});

	it('uses ProvenanceService for seed data with 0.8 confidence', async () => {
		const buildSpy = vi.spyOn(provenanceService, 'buildProvenance');

		await service.deploy('team-1', 'crm', { includeSeedData: true });

		expect(buildSpy).toHaveBeenCalledWith(
			expect.any(Object),
			'blueprint-seed',
			0.8,
		);
	});

	it('resolves @ref: cross-references in seed data', async () => {
		await service.deploy('team-1', 'crm', { includeSeedData: true });

		// The update call for @ref resolution should have resolved company_id
		// rec-1 = workspace, rec-2 = first company seed, rec-3 = first contact seed
		// The contact seed has company_id: '@ref:companies:0' which should resolve to the company's record ID
		const updateCalls = db._updateCalls;
		expect(updateCalls.length).toBeGreaterThan(0);

		// The resolved data should contain a UUID-like value instead of @ref:
		const resolvedData = updateCalls[0].data;
		expect(resolvedData.company_id).not.toContain('@ref:');
	});

	it('does not seed data when includeSeedData is false', async () => {
		await service.deploy('team-1', 'crm', { includeSeedData: false });
		expect(constraintService.validate).not.toHaveBeenCalled();
	});
});
