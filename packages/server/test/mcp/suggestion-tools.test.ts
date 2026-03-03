import { describe, it, expect, beforeAll } from 'vitest';
import { registerTools } from '../../src/mcp/tools/index.js';
import {
	createMockMcpServer,
	createMockServiceContainer,
	createAuthContextGetter,
	getResultText,
	getResultJson,
} from './setup.js';

describe('Suggestion Tools', () => {
	let server: ReturnType<typeof createMockMcpServer>;
	let services: ReturnType<typeof createMockServiceContainer>;

	beforeAll(() => {
		server = createMockMcpServer();
		services = createMockServiceContainer();
		registerTools(server as any, services as any, createAuthContextGetter());
	});

	// ── suggest_field ──

	describe('suggest_field', () => {
		it('should submit a field suggestion successfully', async () => {
			services.schema.findTableBySlug.mockResolvedValueOnce({
				id: 'tbl-1',
				slug: 'contacts',
				name: 'Contacts',
			});
			services.suggestion.suggest.mockResolvedValueOnce({ id: 'sug-42' });

			const result = await server.invokeTool('suggest_field', {
				table: 'contacts',
				fieldName: 'Phone Number',
				fieldType: 'text',
				rationale: 'Need to track phone numbers for outbound calls',
			});

			expect(result.isError).toBeUndefined();
			expect(getResultText(result)).toContain('sug-42');
			expect(getResultText(result)).toContain('Awaiting admin approval');

			expect(services.suggestion.suggest).toHaveBeenCalledWith(
				'team-test-1',
				'user-test-1',
				expect.objectContaining({
					tableId: 'tbl-1',
					fieldName: 'Phone Number',
					fieldSlug: 'phone_number',
					fieldType: 'text',
					rationale: 'Need to track phone numbers for outbound calls',
				}),
			);
		});

		it('should return error when table is not found', async () => {
			services.schema.findTableBySlug.mockResolvedValueOnce(null);

			const result = await server.invokeTool('suggest_field', {
				table: 'nonexistent',
				fieldName: 'Some Field',
				fieldType: 'text',
				rationale: 'Testing',
			});

			expect(result.isError).toBe(true);
			expect(getResultText(result)).toContain("'nonexistent' not found");
		});

		it('should pass exampleValue when provided', async () => {
			services.schema.findTableBySlug.mockResolvedValueOnce({
				id: 'tbl-1',
				slug: 'contacts',
				name: 'Contacts',
			});
			services.suggestion.suggest.mockResolvedValueOnce({ id: 'sug-43' });

			await server.invokeTool('suggest_field', {
				table: 'contacts',
				fieldName: 'Revenue',
				fieldType: 'number',
				rationale: 'Track annual revenue',
				exampleValue: 50000,
			});

			expect(services.suggestion.suggest).toHaveBeenCalledWith(
				'team-test-1',
				'user-test-1',
				expect.objectContaining({
					exampleValue: 50000,
				}),
			);
		});
	});

	// ── list_suggestions ──

	describe('list_suggestions', () => {
		it('should list pending suggestions', async () => {
			const mockSuggestions = [
				{ id: 'sug-1', fieldName: 'Phone', status: 'pending' },
				{ id: 'sug-2', fieldName: 'LinkedIn', status: 'pending' },
			];
			services.suggestion.listPending.mockResolvedValueOnce(mockSuggestions);

			const result = await server.invokeTool('list_suggestions', {});

			expect(result.isError).toBeUndefined();
			const json = getResultJson(result) as any[];
			expect(json).toHaveLength(2);
			expect(json[0].id).toBe('sug-1');
			expect(json[1].fieldName).toBe('LinkedIn');

			expect(services.suggestion.listPending).toHaveBeenCalledWith('team-test-1');
		});

		it('should return empty array when no pending suggestions', async () => {
			services.suggestion.listPending.mockResolvedValueOnce([]);

			const result = await server.invokeTool('list_suggestions', {});

			expect(result.isError).toBeUndefined();
			const json = getResultJson(result) as any[];
			expect(json).toEqual([]);
		});
	});

	// ── approve_suggestion ──

	describe('approve_suggestion', () => {
		it('should approve a suggestion and create the field', async () => {
			services.suggestion.approve.mockResolvedValueOnce({
				id: 'fld-new',
				slug: 'phone_number',
			});

			const sugId = '550e8400-e29b-41d4-a716-446655440000';
			const result = await server.invokeTool('approve_suggestion', {
				suggestionId: sugId,
			});

			expect(result.isError).toBeUndefined();
			expect(getResultText(result)).toContain('Suggestion approved');
			expect(getResultText(result)).toContain('fld-new');

			expect(services.suggestion.approve).toHaveBeenCalledWith(
				sugId,
				'team-test-1',
				'user-test-1',
				undefined,
			);
		});

		it('should pass note when provided', async () => {
			services.suggestion.approve.mockResolvedValueOnce({
				id: 'fld-new',
				slug: 'revenue',
			});

			const sugId = '550e8400-e29b-41d4-a716-446655440001';
			await server.invokeTool('approve_suggestion', {
				suggestionId: sugId,
				note: 'Looks good, adding to contacts table',
			});

			expect(services.suggestion.approve).toHaveBeenCalledWith(
				sugId,
				'team-test-1',
				'user-test-1',
				'Looks good, adding to contacts table',
			);
		});
	});

	// ── reject_suggestion ──

	describe('reject_suggestion', () => {
		it('should reject a suggestion successfully', async () => {
			services.suggestion.reject.mockResolvedValueOnce(undefined);

			const sugId = '550e8400-e29b-41d4-a716-446655440002';
			const result = await server.invokeTool('reject_suggestion', {
				suggestionId: sugId,
			});

			expect(result.isError).toBeUndefined();
			expect(getResultText(result)).toBe('Suggestion rejected.');

			expect(services.suggestion.reject).toHaveBeenCalledWith(
				sugId,
				'team-test-1',
				'user-test-1',
				undefined,
			);
		});

		it('should pass note when rejecting', async () => {
			services.suggestion.reject.mockResolvedValueOnce(undefined);

			const sugId = '550e8400-e29b-41d4-a716-446655440003';
			await server.invokeTool('reject_suggestion', {
				suggestionId: sugId,
				note: 'Duplicate of existing field',
			});

			expect(services.suggestion.reject).toHaveBeenCalledWith(
				sugId,
				'team-test-1',
				'user-test-1',
				'Duplicate of existing field',
			);
		});
	});
});
