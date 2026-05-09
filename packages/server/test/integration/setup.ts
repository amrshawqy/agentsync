import type { RequestContext } from '@agentsync/types';
import type { PermissionEvaluation } from '@agentsync/types';
import { vi } from 'vitest';

// ── Mock DB ──

export function createMockDb() {
	const insertRows: any[] = [];
	const selectRows: any[] = [];
	let updateRows: any[] = [];

	const returningFn = vi.fn(() => insertRows);
	const selectReturningFn = vi.fn(() => selectRows);
	const updateReturningFn = vi.fn(() => updateRows);

	const chainable = {
		values: vi.fn().mockReturnThis(),
		returning: returningFn,
		where: vi.fn().mockReturnThis(),
		orderBy: vi.fn().mockReturnThis(),
		limit: vi.fn().mockReturnThis(),
		offset: vi.fn().mockReturnThis(),
		set: vi.fn().mockReturnThis(),
	};

	const db = {
		select: vi.fn(() => ({
			from: vi.fn(() => ({
				where: vi.fn(() => ({
					orderBy: vi.fn(() => ({
						limit: vi.fn(() => ({
							offset: vi.fn(() => selectRows),
						})),
					})),
				})),
			})),
		})),
		insert: vi.fn(() => ({
			values: vi.fn(() => ({
				returning: returningFn,
			})),
		})),
		update: vi.fn(() => ({
			set: vi.fn(() => ({
				where: vi.fn(() => ({
					returning: updateReturningFn,
				})),
			})),
		})),
		delete: vi.fn(() => ({
			where: vi.fn(),
		})),
		transaction: vi.fn(async (fn: any) => fn(db)),
		_mock: {
			setInsertResult: (rows: any[]) => {
				insertRows.length = 0;
				insertRows.push(...rows);
			},
			setSelectResult: (rows: any[]) => {
				selectRows.length = 0;
				selectRows.push(...rows);
			},
			setUpdateResult: (rows: any[]) => {
				updateRows = rows;
				updateReturningFn.mockReturnValue(rows);
			},
		},
	};

	return db as any;
}

// ── Mock Services ──

export function createMockSchemaService() {
	return {
		getTableById: vi.fn().mockResolvedValue({
			id: 'table-1',
			teamId: 'team-1',
			workspaceId: 'ws-1',
			slug: 'contacts',
			name: 'Contacts',
		}),
		getWorkspaceById: vi.fn().mockResolvedValue({
			id: 'ws-1',
			slug: 'sales',
		}),
		getFieldsForTable: vi.fn().mockResolvedValue([]),
		getSchemaOverview: vi.fn().mockResolvedValue([]),
		createTable: vi.fn().mockResolvedValue({ id: 'table-1', slug: 'contacts' }),
		createField: vi.fn().mockResolvedValue({ id: 'field-1' }),
		findTableBySlug: vi.fn().mockResolvedValue({ id: 'table-1' }),
		invalidateSchemaCache: vi.fn(),
	} as any;
}

export function createMockPermissionService(evaluation?: Partial<PermissionEvaluation>) {
	return {
		evaluate: vi.fn().mockResolvedValue({
			allowed: true,
			layer: 6,
			reason: 'Permitted',
			fieldAccess: undefined,
			...evaluation,
		}),
	} as any;
}

export function createMockConstraintService() {
	return {
		validate: vi.fn().mockResolvedValue([]),
	} as any;
}

export function createMockEventService() {
	const emittedEvents: any[] = [];
	return {
		emit: vi.fn(async (event: any) => {
			emittedEvents.push(event);
		}),
		subscribe: vi.fn(),
		replay: vi.fn(),
		_emittedEvents: emittedEvents,
	} as any;
}

export function createMockAuditService() {
	return {
		log: vi.fn(),
		query: vi.fn().mockResolvedValue([]),
	} as any;
}

export function createMockIndexService() {
	return {
		updateIndexes: vi.fn(),
		deleteIndexes: vi.fn(),
	} as any;
}

export function createMockRelationService() {
	return {
		link: vi.fn().mockResolvedValue({ id: 'rel-1' }),
		unlink: vi.fn(),
		getRelationsForRecord: vi.fn().mockResolvedValue([]),
		traverse: vi.fn().mockResolvedValue([]),
	} as any;
}

export function createMockSearchService() {
	return {
		search: vi.fn().mockResolvedValue([]),
		fullTextSearch: vi.fn().mockResolvedValue([]),
	} as any;
}

export function createTestContext(overrides?: Partial<RequestContext>): RequestContext {
	return {
		teamId: 'team-1',
		userId: 'user-1',
		roleId: 'role-1',
		permissions: {},
		...overrides,
	};
}
