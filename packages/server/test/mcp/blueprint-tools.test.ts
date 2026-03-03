import { describe, it, expect, beforeAll } from 'vitest';
import { registerTools } from '../../src/mcp/tools/index.js';
import {
	createMockMcpServer,
	createMockServiceContainer,
	createAuthContextGetter,
	getResultText,
	getResultJson,
} from './setup.js';

describe('Blueprint Tools', () => {
	let server: ReturnType<typeof createMockMcpServer>;
	let services: ReturnType<typeof createMockServiceContainer>;

	beforeAll(() => {
		server = createMockMcpServer();
		services = createMockServiceContainer();
		registerTools(server as any, services as any, createAuthContextGetter());
	});

	// ── deploy_blueprint ──

	describe('deploy_blueprint', () => {
		it('should deploy a blueprint and create a workspace', async () => {
			services.blueprint.deploy.mockResolvedValueOnce({
				id: 'ws-deployed',
				slug: 'sales-crm',
				name: 'Sales CRM',
			});

			const result = await server.invokeTool('deploy_blueprint', {
				blueprintSlug: 'crm',
				workspaceName: 'Sales CRM',
				workspaceSlug: 'sales-crm',
			});

			expect(result.isError).toBeUndefined();
			expect(getResultText(result)).toContain('Blueprint deployed');
			expect(getResultText(result)).toContain('Sales CRM');
			expect(getResultText(result)).toContain('sales-crm');

			expect(services.blueprint.deploy).toHaveBeenCalledWith(
				'team-test-1',
				'crm',
				expect.objectContaining({
					workspaceName: 'Sales CRM',
					workspaceSlug: 'sales-crm',
					includeSeedData: false,
				}),
			);
		});

		it('should emit blueprint.deployed event after deploying', async () => {
			services.blueprint.deploy.mockResolvedValueOnce({
				id: 'ws-deployed-2',
				slug: 'hr',
				name: 'HR',
			});

			await server.invokeTool('deploy_blueprint', {
				blueprintSlug: 'hr',
			});

			expect(services.event.emit).toHaveBeenCalledWith(
				expect.objectContaining({
					eventType: 'blueprint.deployed',
					teamId: 'team-test-1',
					data: expect.objectContaining({
						blueprintSlug: 'hr',
						workspaceSlug: 'hr',
					}),
				}),
			);
		});

		it('should pass includeSeedData when true', async () => {
			services.blueprint.deploy.mockResolvedValueOnce({
				id: 'ws-seed',
				slug: 'demo',
				name: 'Demo',
			});

			await server.invokeTool('deploy_blueprint', {
				blueprintSlug: 'crm',
				includeSeedData: true,
			});

			expect(services.blueprint.deploy).toHaveBeenCalledWith(
				'team-test-1',
				'crm',
				expect.objectContaining({
					includeSeedData: true,
				}),
			);
		});
	});

	// ── create_blueprint ──

	describe('create_blueprint', () => {
		it('should create a new blueprint', async () => {
			services.blueprint.create.mockResolvedValueOnce({
				id: 'bp-new',
				slug: 'inventory',
				version: 1,
			});

			const result = await server.invokeTool('create_blueprint', {
				slug: 'inventory',
				name: 'Inventory Management',
				description: 'Track warehouse inventory',
				category: 'operations',
				tables: [
					{
						slug: 'products',
						name: 'Products',
						fields: [
							{ slug: 'sku', name: 'SKU', fieldType: 'text', isRequired: true },
							{ slug: 'quantity', name: 'Quantity', fieldType: 'number' },
						],
					},
				],
			});

			expect(result.isError).toBeUndefined();
			const json = getResultJson(result) as any;
			expect(json.id).toBe('bp-new');
			expect(json.slug).toBe('inventory');
			expect(json.version).toBe(1);

			expect(services.blueprint.create).toHaveBeenCalledWith(
				expect.objectContaining({
					slug: 'inventory',
					name: 'Inventory Management',
					description: 'Track warehouse inventory',
					category: 'operations',
					schemaDefinition: {
						tables: expect.arrayContaining([
							expect.objectContaining({ slug: 'products', name: 'Products' }),
						]),
					},
				}),
				'team-test-1',
			);
		});
	});

	// ── evolve_blueprint ──

	describe('evolve_blueprint', () => {
		it('should evolve a blueprint to a new version', async () => {
			services.blueprint.evolve.mockResolvedValueOnce({
				id: 'bp-1',
				slug: 'crm',
				version: 3,
			});

			const result = await server.invokeTool('evolve_blueprint', {
				blueprintSlug: 'crm',
				changes: { addTable: { slug: 'deals', name: 'Deals', fields: [] } },
			});

			expect(result.isError).toBeUndefined();
			expect(getResultText(result)).toContain('v3');
			expect(getResultText(result)).toContain('bp-1');

			expect(services.blueprint.evolve).toHaveBeenCalledWith('crm', {
				addTable: { slug: 'deals', name: 'Deals', fields: [] },
			});
		});

		it('should emit blueprint.evolved event', async () => {
			services.blueprint.evolve.mockResolvedValueOnce({
				id: 'bp-2',
				slug: 'hr',
				version: 2,
			});

			await server.invokeTool('evolve_blueprint', {
				blueprintSlug: 'hr',
				changes: { removeField: { table: 'employees', field: 'fax' } },
			});

			expect(services.event.emit).toHaveBeenCalledWith(
				expect.objectContaining({
					eventType: 'blueprint.evolved',
					teamId: 'team-test-1',
					data: expect.objectContaining({
						blueprintSlug: 'hr',
						newVersion: 2,
					}),
				}),
			);
		});
	});

	// ── publish_blueprint ──

	describe('publish_blueprint', () => {
		it('should publish a blueprint to the marketplace', async () => {
			services.blueprint.publish.mockResolvedValueOnce({
				id: 'bp-1',
				slug: 'crm',
				isPublished: true,
			});

			const result = await server.invokeTool('publish_blueprint', {
				slug: 'crm',
			});

			expect(result.isError).toBeUndefined();
			expect(getResultText(result)).toContain("'crm' published to marketplace");

			expect(services.blueprint.publish).toHaveBeenCalledWith('crm');
		});
	});

	// ── list_blueprints ──

	describe('list_blueprints', () => {
		it('should list all blueprints', async () => {
			services.blueprint.listBuiltin.mockResolvedValueOnce([
				{ id: 'bp-crm', slug: 'crm', name: 'CRM', category: 'sales', version: 1 },
				{ id: 'bp-hr', slug: 'hr', name: 'HR', category: 'people', version: 1 },
			]);
			services.blueprint.listPublished.mockResolvedValueOnce([
				{ id: 'bp-custom', slug: 'inventory', name: 'Inventory', category: 'operations', version: 1 },
			]);

			const result = await server.invokeTool('list_blueprints', {});

			expect(result.isError).toBeUndefined();
			const json = getResultJson(result) as any[];
			expect(json).toHaveLength(3);

			const slugs = json.map((b: any) => b.slug);
			expect(slugs).toContain('crm');
			expect(slugs).toContain('hr');
			expect(slugs).toContain('inventory');
		});

		it('should filter blueprints by category', async () => {
			services.blueprint.listBuiltin.mockResolvedValueOnce([
				{ id: 'bp-crm', slug: 'crm', name: 'CRM', category: 'sales', version: 1 },
				{ id: 'bp-hr', slug: 'hr', name: 'HR', category: 'people', version: 1 },
			]);
			services.blueprint.listPublished.mockResolvedValueOnce([
				{ id: 'bp-pipeline', slug: 'pipeline', name: 'Pipeline', category: 'sales', version: 1 },
			]);

			const result = await server.invokeTool('list_blueprints', {
				category: 'sales',
			});

			expect(result.isError).toBeUndefined();
			const json = getResultJson(result) as any[];
			expect(json).toHaveLength(2);
			expect(json.every((b: any) => b.category === 'sales')).toBe(true);
		});

		it('should deduplicate blueprints appearing in both builtin and published', async () => {
			const sharedBlueprint = {
				id: 'bp-crm',
				slug: 'crm',
				name: 'CRM',
				category: 'sales',
				version: 1,
			};
			services.blueprint.listBuiltin.mockResolvedValueOnce([sharedBlueprint]);
			services.blueprint.listPublished.mockResolvedValueOnce([sharedBlueprint]);

			const result = await server.invokeTool('list_blueprints', {});

			expect(result.isError).toBeUndefined();
			const json = getResultJson(result) as any[];
			expect(json).toHaveLength(1);
			expect(json[0].slug).toBe('crm');
		});
	});
});
