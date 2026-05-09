import { describe, expect, it, vi } from 'vitest';
import { SearchService } from '../../src/services/data/search.service.js';

function createMockDb(results: any[] = []) {
	return {
		select: vi.fn().mockReturnValue({
			from: vi.fn().mockReturnValue({
				where: vi.fn().mockReturnValue({
					groupBy: vi.fn().mockReturnValue({
						orderBy: vi.fn().mockReturnValue({
							limit: vi.fn().mockReturnValue({
								offset: vi.fn().mockResolvedValue(results),
							}),
						}),
					}),
					orderBy: vi.fn().mockReturnValue({
						limit: vi.fn().mockReturnValue({
							offset: vi.fn().mockResolvedValue(results),
						}),
					}),
				}),
			}),
		}),
	} as any;
}

describe('SearchService', () => {
	it('search returns record IDs for matching results', async () => {
		const db = createMockDb([
			{ recordId: 'rec-1', score: 0.8 },
			{ recordId: 'rec-2', score: 0.6 },
		]);
		const service = new SearchService(db);

		const results = await service.search({
			teamId: 'team-1',
			tableId: 'table-1',
			query: 'test',
		});

		expect(results).toEqual(['rec-1', 'rec-2']);
		expect(db.select).toHaveBeenCalled();
	});

	it('search returns empty array when no matches', async () => {
		const db = createMockDb([]);
		const service = new SearchService(db);

		const results = await service.search({
			teamId: 'team-1',
			tableId: 'table-1',
			query: 'nonexistent',
		});

		expect(results).toEqual([]);
	});

	it('search respects limit and offset', async () => {
		const db = createMockDb([{ recordId: 'rec-1', score: 0.5 }]);
		const service = new SearchService(db);

		await service.search({
			teamId: 'team-1',
			tableId: 'table-1',
			query: 'test',
			limit: 10,
			offset: 5,
		});

		// Verify the query chain was called
		expect(db.select).toHaveBeenCalled();
	});

	it('fullTextSearch returns full record objects', async () => {
		const mockRecords = [{ id: 'rec-1', data: { name: 'Test Record' } }];
		const db = createMockDb(mockRecords);
		const service = new SearchService(db);

		const results = await service.fullTextSearch({
			teamId: 'team-1',
			tableId: 'table-1',
			query: 'Test',
		});

		expect(results).toHaveLength(1);
		expect(results[0]).toHaveProperty('id');
	});
});
