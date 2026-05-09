import { describe, expect, it, vi } from 'vitest';
import { RevisionService } from '../../src/services/data/revision.service.js';

function makeMockDb(rows: any[] = []) {
	const insertedValues: any[] = [];
	const db: any = {
		insert: vi.fn(() => ({
			values: vi.fn(async (v: any) => {
				insertedValues.push(v);
			}),
		})),
		select: vi.fn(() => ({
			from: vi.fn(() => ({
				where: vi.fn(() => ({
					orderBy: vi.fn(() => ({
						limit: vi.fn(() => ({
							offset: vi.fn(async () => rows),
						})),
					})),
				})),
			})),
		})),
		_inserted: insertedValues,
	};
	return db;
}

describe('RevisionService', () => {
	it('records a revision into the table', async () => {
		const db = makeMockDb();
		const svc = new RevisionService(db as any);
		await svc.record(db as any, {
			recordId: 'rec-1',
			teamId: 'team-1',
			revisionKind: 'create',
			data: { name: 'Acme' },
			provenance: { name: { agent: 'u1', at: '2024-01-01' } },
			createdBy: 'user-1',
		});
		expect(db._inserted).toHaveLength(1);
		expect(db._inserted[0]).toMatchObject({
			recordId: 'rec-1',
			teamId: 'team-1',
			revisionKind: 'create',
			createdBy: 'user-1',
		});
	});

	it('exposes the retention window', () => {
		const db = makeMockDb();
		const svc = new RevisionService(db as any);
		expect(svc.retentionDays).toBe(7);
	});
});
