import { beforeAll, describe, expect, it } from 'vitest';
import { registerTools } from '../../src/mcp/tools/index.js';
import {
	createAuthContextGetter,
	createMockMcpServer,
	createMockServiceContainer,
	getResultJson,
	getResultText,
} from './setup.js';

describe('MCP Data Tools', () => {
	const mcp = createMockMcpServer();
	const services = createMockServiceContainer();

	beforeAll(() => {
		registerTools(mcp as any, services as any, createAuthContextGetter());
	});

	// ── create_record ──

	describe('create_record', () => {
		it('creates a record successfully', async () => {
			const result = await mcp.invokeTool('create_record', {
				table: 'contacts',
				data: { name: 'Alice', email: 'alice@example.com' },
			});

			expect(result.isError).toBeFalsy();
			const json = getResultJson(result) as any;
			expect(json).toHaveProperty('id', 'rec-1');
			expect(services.schema.findTableBySlug).toHaveBeenCalledWith('team-test-1', 'contacts');
			expect(services.data.createRecord).toHaveBeenCalledWith(
				expect.objectContaining({ teamId: 'team-test-1' }),
				expect.objectContaining({
					tableId: 'tbl-1',
					data: { name: 'Alice', email: 'alice@example.com' },
				}),
			);
		});

		it('returns an error when the table is not found', async () => {
			services.schema.findTableBySlug.mockResolvedValueOnce(null);

			const result = await mcp.invokeTool('create_record', {
				table: 'nonexistent',
				data: { foo: 'bar' },
			});

			expect(result.isError).toBe(true);
			expect(getResultText(result)).toContain("Table 'nonexistent' not found");
		});

		it('passes confidence and links when provided', async () => {
			const targetId = '00000000-0000-0000-0000-000000000002';
			await mcp.invokeTool('create_record', {
				table: 'contacts',
				data: { name: 'Bob' },
				confidence: 0.85,
				links: [{ targetRecordId: targetId, relationType: 'company' }],
			});

			expect(services.data.createRecord).toHaveBeenCalledWith(
				expect.anything(),
				expect.objectContaining({
					confidence: 0.85,
					links: [{ targetRecordId: targetId, relationType: 'company' }],
				}),
			);
		});

		it('resolves table via workspace slug when provided', async () => {
			await mcp.invokeTool('create_record', {
				table: 'contacts',
				workspace: 'crm',
				data: { name: 'Carol' },
			});

			expect(services.schema.getWorkspaceBySlug).toHaveBeenCalledWith('team-test-1', 'crm');
			expect(services.schema.getTableBySlug).toHaveBeenCalledWith(
				'team-test-1',
				'ws-1',
				'contacts',
			);
		});
	});

	// ── update_record ──

	describe('update_record', () => {
		it('updates a record successfully', async () => {
			const recordId = '00000000-0000-0000-0000-000000000001';
			const result = await mcp.invokeTool('update_record', {
				recordId,
				updates: { name: 'Updated Name' },
			});

			expect(result.isError).toBeFalsy();
			const json = getResultJson(result) as any;
			expect(json).toHaveProperty('id', 'rec-1');
			expect(services.data.updateRecord).toHaveBeenCalledWith(
				expect.objectContaining({ teamId: 'team-test-1' }),
				recordId,
				expect.objectContaining({ data: { name: 'Updated Name' } }),
			);
		});

		it('passes confidence when provided', async () => {
			const recordId = '00000000-0000-0000-0000-000000000001';
			await mcp.invokeTool('update_record', {
				recordId,
				updates: { email: 'new@example.com' },
				confidence: 0.9,
			});

			expect(services.data.updateRecord).toHaveBeenCalledWith(
				expect.anything(),
				recordId,
				expect.objectContaining({ confidence: 0.9 }),
			);
		});
	});

	// ── delete_record ──

	describe('delete_record', () => {
		it('deletes a record and logs the reason', async () => {
			const recordId = '00000000-0000-0000-0000-000000000001';
			const result = await mcp.invokeTool('delete_record', {
				recordId,
				reason: 'Duplicate entry',
			});

			expect(result.isError).toBeFalsy();
			expect(getResultText(result)).toContain(recordId);
			expect(getResultText(result)).toContain('deleted');
			expect(services.data.deleteRecord).toHaveBeenCalledWith(
				expect.objectContaining({ teamId: 'team-test-1' }),
				recordId,
				'Duplicate entry',
			);
		});

		it('deletes a record without a reason', async () => {
			const recordId = '00000000-0000-0000-0000-000000000003';
			const result = await mcp.invokeTool('delete_record', { recordId });

			expect(result.isError).toBeFalsy();
			expect(getResultText(result)).toContain('deleted');
			expect(services.data.deleteRecord).toHaveBeenCalledWith(
				expect.objectContaining({ teamId: 'team-test-1' }),
				recordId,
				undefined,
			);
		});
	});

	// ── get_record ──

	describe('get_record', () => {
		it('fetches a record successfully', async () => {
			const recordId = '00000000-0000-0000-0000-000000000001';
			const result = await mcp.invokeTool('get_record', { recordId });

			expect(result.isError).toBeFalsy();
			const json = getResultJson(result) as any;
			expect(json).toHaveProperty('id', 'rec-1');
			expect(json).toHaveProperty('relations');
			expect(services.data.getRecord).toHaveBeenCalledWith(
				expect.objectContaining({ teamId: 'team-test-1' }),
				recordId,
			);
		});

		it('returns an error when the record is not found', async () => {
			services.data.getRecord.mockResolvedValueOnce(null);

			const recordId = '00000000-0000-0000-0000-000000000099';
			const result = await mcp.invokeTool('get_record', { recordId });

			expect(result.isError).toBe(true);
			expect(getResultText(result)).toBe('Record not found');
		});
	});

	// ── query_records ──

	describe('query_records', () => {
		it('queries records with filters successfully', async () => {
			const result = await mcp.invokeTool('query_records', {
				table: 'contacts',
				filters: { status: 'active' },
				sort: [{ field: 'name', direction: 'asc' }],
				limit: 10,
				offset: 0,
			});

			expect(result.isError).toBeFalsy();
			const json = getResultJson(result) as any;
			expect(json).toHaveProperty('data');
			expect(json).toHaveProperty('total', 0);
			expect(json).toHaveProperty('hasMore', false);
			expect(services.data.queryRecords).toHaveBeenCalledWith(
				expect.objectContaining({ teamId: 'team-test-1' }),
				expect.objectContaining({
					tableId: 'tbl-1',
					filters: { status: 'active' },
					sort: [{ field: 'name', direction: 'asc' }],
					limit: 10,
					offset: 0,
				}),
			);
		});

		it('passes search parameter for full-text search', async () => {
			await mcp.invokeTool('query_records', {
				table: 'contacts',
				search: 'Alice',
				limit: 20,
				offset: 0,
			});

			expect(services.data.queryRecords).toHaveBeenCalledWith(
				expect.anything(),
				expect.objectContaining({
					search: 'Alice',
				}),
			);
		});

		it('returns an error when the table is not found', async () => {
			services.schema.findTableBySlug.mockResolvedValueOnce(null);

			const result = await mcp.invokeTool('query_records', {
				table: 'missing_table',
				limit: 20,
				offset: 0,
			});

			expect(result.isError).toBe(true);
			expect(getResultText(result)).toContain("Table 'missing_table' not found");
		});
	});

	// ── link_records ──

	describe('link_records', () => {
		it('links two records and emits an event', async () => {
			const sourceId = '00000000-0000-0000-0000-000000000001';
			const targetId = '00000000-0000-0000-0000-000000000002';
			const result = await mcp.invokeTool('link_records', {
				sourceRecordId: sourceId,
				targetRecordId: targetId,
				relationType: 'company',
			});

			expect(result.isError).toBeFalsy();
			const json = getResultJson(result) as any;
			expect(json).toHaveProperty('id', 'rel-1');
			expect(json).toHaveProperty('sourceRecordId', 'rec-1');
			expect(json).toHaveProperty('targetRecordId', 'rec-2');
			expect(json).toHaveProperty('relationType', 'contact');
			expect(services.relation.link).toHaveBeenCalledWith(
				expect.objectContaining({
					teamId: 'team-test-1',
					sourceRecordId: sourceId,
					targetRecordId: targetId,
					relationType: 'company',
					createdBy: 'user-test-1',
				}),
			);
			expect(services.event.emit).toHaveBeenCalledWith(
				expect.objectContaining({
					eventType: 'relation.added',
					teamId: 'team-test-1',
					data: expect.objectContaining({
						sourceRecordId: sourceId,
						targetRecordId: targetId,
						relationType: 'company',
					}),
				}),
			);
		});
	});

	// ── unlink_records ──

	describe('unlink_records', () => {
		it('unlinks two records and emits an event', async () => {
			const sourceId = '00000000-0000-0000-0000-000000000001';
			const targetId = '00000000-0000-0000-0000-000000000002';
			const result = await mcp.invokeTool('unlink_records', {
				sourceRecordId: sourceId,
				targetRecordId: targetId,
				relationType: 'company',
			});

			expect(result.isError).toBeFalsy();
			expect(getResultText(result)).toBe('Unlinked.');
			expect(services.relation.unlink).toHaveBeenCalledWith(
				'team-test-1',
				sourceId,
				targetId,
				'company',
			);
			expect(services.event.emit).toHaveBeenCalledWith(
				expect.objectContaining({
					eventType: 'relation.removed',
					teamId: 'team-test-1',
					data: expect.objectContaining({
						sourceRecordId: sourceId,
						targetRecordId: targetId,
						relationType: 'company',
					}),
				}),
			);
		});
	});

	// ── traverse ──

	describe('traverse', () => {
		it('traverses relations along a dot-separated path', async () => {
			const startId = '00000000-0000-0000-0000-000000000001';
			const result = await mcp.invokeTool('traverse', {
				startRecordId: startId,
				path: 'company.employees',
				depth: 3,
			});

			expect(result.isError).toBeFalsy();
			const json = getResultJson(result) as any;
			expect(Array.isArray(json)).toBe(true);
			expect(json).toHaveLength(1);
			expect(json[0]).toHaveProperty('id', 'rec-2');
			expect(services.relation.traverse).toHaveBeenCalledWith(
				startId,
				['company', 'employees'],
				'team-test-1',
				3,
			);
		});

		it('splits a single-segment path correctly', async () => {
			const startId = '00000000-0000-0000-0000-000000000001';
			await mcp.invokeTool('traverse', {
				startRecordId: startId,
				path: 'parent',
				depth: 1,
			});

			expect(services.relation.traverse).toHaveBeenCalledWith(
				startId,
				['parent'],
				'team-test-1',
				1,
			);
		});
	});

	// ── verify_field ──

	describe('verify_field', () => {
		it('verifies a field and returns provenance', async () => {
			const recordId = '00000000-0000-0000-0000-000000000001';
			const result = await mcp.invokeTool('verify_field', {
				recordId,
				field: 'email',
				method: 'dns-lookup',
				outcome: 'valid',
			});

			expect(result.isError).toBeFalsy();
			const json = getResultJson(result) as any;
			expect(json).toHaveProperty('email');
			expect(json.email).toHaveProperty('confidence', 1);
			expect(services.data.verifyField).toHaveBeenCalledWith(
				expect.objectContaining({ teamId: 'team-test-1' }),
				recordId,
				'email',
				'dns-lookup',
				'valid',
			);
		});
	});

	// ── bulk_import ──

	describe('bulk_import', () => {
		it('imports JSON records successfully', async () => {
			const result = await mcp.invokeTool('bulk_import', {
				table: 'contacts',
				records: [
					{ name: 'Alice', email: 'alice@example.com' },
					{ name: 'Bob', email: 'bob@example.com' },
				],
			});

			expect(result.isError).toBeFalsy();
			expect(getResultText(result)).toContain('Imported 2 records');
			expect(services.data.bulkImport).toHaveBeenCalledWith(
				expect.objectContaining({ teamId: 'team-test-1' }),
				'tbl-1',
				[
					{ name: 'Alice', email: 'alice@example.com' },
					{ name: 'Bob', email: 'bob@example.com' },
				],
			);
		});

		it('imports CSV via base64 encoding', async () => {
			const csv = 'name,email\nCharlie,charlie@example.com\nDiana,diana@example.com';
			const csvBase64 = Buffer.from(csv).toString('base64');

			const result = await mcp.invokeTool('bulk_import', {
				table: 'contacts',
				csvBase64,
			});

			expect(result.isError).toBeFalsy();
			expect(getResultText(result)).toContain('Imported 2 records');
			expect(services.data.bulkImport).toHaveBeenCalledWith(
				expect.objectContaining({ teamId: 'team-test-1' }),
				'tbl-1',
				expect.arrayContaining([
					expect.objectContaining({ name: 'Charlie', email: 'charlie@example.com' }),
					expect.objectContaining({ name: 'Diana', email: 'diana@example.com' }),
				]),
			);
		});

		it('returns an error when the table is not found', async () => {
			services.schema.findTableBySlug.mockResolvedValueOnce(null);

			const result = await mcp.invokeTool('bulk_import', {
				table: 'nonexistent',
				records: [{ name: 'Test' }],
			});

			expect(result.isError).toBe(true);
			expect(getResultText(result)).toContain("Table 'nonexistent' not found");
		});

		it('returns an error when both records and csvBase64 are provided', async () => {
			const csv = 'name\nAlice';
			const csvBase64 = Buffer.from(csv).toString('base64');

			const result = await mcp.invokeTool('bulk_import', {
				table: 'contacts',
				records: [{ name: 'Alice' }],
				csvBase64,
			});

			expect(result.isError).toBe(true);
			expect(getResultText(result)).toContain('not both');
		});

		it('returns an error when neither records nor csvBase64 are provided', async () => {
			const result = await mcp.invokeTool('bulk_import', {
				table: 'contacts',
			});

			expect(result.isError).toBe(true);
			expect(getResultText(result)).toContain('Provide either');
		});
	});
});
