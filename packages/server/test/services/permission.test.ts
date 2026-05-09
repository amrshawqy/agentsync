import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PermissionService } from '../../src/services/auth/permission.service.js';

// Mock drizzle-orm so the import in permission.service doesn't break
vi.mock('drizzle-orm', () => ({
	eq: vi.fn(),
}));

// Mock the @agentsync/db table imports
vi.mock('@agentsync/db', () => ({
	users: { id: 'users.id' },
	roles: { id: 'roles.id' },
}));

function createMockCache() {
	return {
		get: vi.fn().mockResolvedValue(null),
		set: vi.fn().mockResolvedValue(undefined),
		del: vi.fn().mockResolvedValue(undefined),
		delPattern: vi.fn().mockResolvedValue(undefined),
		exists: vi.fn().mockResolvedValue(false),
		incr: vi.fn().mockResolvedValue(1),
	} as any;
}

function createMockDb(queryResult: any[]) {
	const chain = {
		select: vi.fn().mockReturnThis(),
		from: vi.fn().mockReturnThis(),
		where: vi.fn().mockResolvedValue(queryResult),
	};
	return chain as any;
}

/**
 * Creates a mock DB that returns different results for sequential calls.
 * First call returns userResult, second call returns roleResult.
 */
function createSequentialMockDb(userResult: any[], roleResult: any[]) {
	let callCount = 0;
	const chain = {
		select: vi.fn().mockReturnThis(),
		from: vi.fn().mockReturnThis(),
		where: vi.fn().mockImplementation(() => {
			callCount++;
			if (callCount === 1) return Promise.resolve(userResult);
			return Promise.resolve(roleResult);
		}),
	};
	return chain as any;
}

describe('PermissionService', () => {
	let cache: ReturnType<typeof createMockCache>;

	const baseParams = {
		teamId: 'team-1',
		userId: 'user-1',
		roleId: 'role-1',
		workspace: 'sales',
		table: 'contacts',
		action: 'read' as const,
	};

	beforeEach(() => {
		cache = createMockCache();
	});

	it('denies access when user not active in team', async () => {
		const db = createMockDb([{ id: 'user-1', status: 'suspended', teamId: 'team-1' }]);
		const service = new PermissionService(db, cache);

		const result = await service.evaluate(baseParams);

		expect(result.allowed).toBe(false);
		expect(result.layer).toBe(1);
		expect(result.reason).toBe('User not active in team');
	});

	it('denies access when user not found', async () => {
		const db = createMockDb([]);
		const service = new PermissionService(db, cache);

		const result = await service.evaluate(baseParams);

		expect(result.allowed).toBe(false);
		expect(result.layer).toBe(1);
		expect(result.reason).toBe('User not active in team');
	});

	it('denies access when user is in a different team', async () => {
		const db = createMockDb([{ id: 'user-1', status: 'active', teamId: 'other-team' }]);
		const service = new PermissionService(db, cache);

		const result = await service.evaluate(baseParams);

		expect(result.allowed).toBe(false);
		expect(result.layer).toBe(1);
		expect(result.reason).toBe('User not active in team');
	});

	it('denies access when role not found', async () => {
		const activeUser = { id: 'user-1', status: 'active', teamId: 'team-1' };
		const db = createSequentialMockDb([activeUser], []);
		const service = new PermissionService(db, cache);

		const result = await service.evaluate(baseParams);

		expect(result.allowed).toBe(false);
		expect(result.layer).toBe(1);
		expect(result.reason).toBe('Role not found');
	});

	it('allows access with admin wildcard permissions', async () => {
		const activeUser = { id: 'user-1', status: 'active', teamId: 'team-1' };
		const adminRole = {
			id: 'role-1',
			permissions: {
				'*': {
					tables: {
						'*': { actions: ['create', 'read', 'update', 'delete'] },
					},
				},
			},
		};
		const db = createSequentialMockDb([activeUser], [adminRole]);
		const service = new PermissionService(db, cache);

		const result = await service.evaluate(baseParams);

		expect(result.allowed).toBe(true);
		expect(result.layer).toBe(2);
		expect(result.reason).toBe('Admin wildcard');
	});

	it('denies access when workspace not in permissions', async () => {
		const activeUser = { id: 'user-1', status: 'active', teamId: 'team-1' };
		const role = {
			id: 'role-1',
			permissions: {
				marketing: {
					tables: {
						campaigns: { actions: ['read'] },
					},
				},
			},
		};
		const db = createSequentialMockDb([activeUser], [role]);
		const service = new PermissionService(db, cache);

		const result = await service.evaluate(baseParams);

		expect(result.allowed).toBe(false);
		expect(result.layer).toBe(2);
		expect(result.reason).toContain('No access to workspace');
	});

	it('denies access when table not in permissions', async () => {
		const activeUser = { id: 'user-1', status: 'active', teamId: 'team-1' };
		const role = {
			id: 'role-1',
			permissions: {
				sales: {
					tables: {
						deals: { actions: ['read'] },
					},
				},
			},
		};
		const db = createSequentialMockDb([activeUser], [role]);
		const service = new PermissionService(db, cache);

		const result = await service.evaluate(baseParams);

		expect(result.allowed).toBe(false);
		expect(result.layer).toBe(3);
		expect(result.reason).toContain('No access to table');
	});

	it('denies access when action not allowed', async () => {
		const activeUser = { id: 'user-1', status: 'active', teamId: 'team-1' };
		const role = {
			id: 'role-1',
			permissions: {
				sales: {
					tables: {
						contacts: { actions: ['read'] },
					},
				},
			},
		};
		const db = createSequentialMockDb([activeUser], [role]);
		const service = new PermissionService(db, cache);

		const result = await service.evaluate({
			...baseParams,
			action: 'delete',
		});

		expect(result.allowed).toBe(false);
		expect(result.layer).toBe(3);
		expect(result.reason).toContain("Action 'delete' not allowed");
	});

	it('allows access with wildcard table permissions', async () => {
		const activeUser = { id: 'user-1', status: 'active', teamId: 'team-1' };
		const role = {
			id: 'role-1',
			permissions: {
				sales: {
					tables: {
						'*': { actions: ['read', 'create', 'update', 'delete'] },
					},
				},
			},
		};
		const db = createSequentialMockDb([activeUser], [role]);
		const service = new PermissionService(db, cache);

		const result = await service.evaluate(baseParams);

		expect(result.allowed).toBe(true);
		expect(result.layer).toBe(6);
		expect(result.reason).toBe('Permitted');
	});

	it('returns field access with hidden and readOnly arrays', async () => {
		const activeUser = { id: 'user-1', status: 'active', teamId: 'team-1' };
		const role = {
			id: 'role-1',
			permissions: {
				sales: {
					tables: {
						contacts: {
							actions: ['read', 'update'],
							field_access: {
								hidden: ['ssn', 'salary'],
								read_only: ['email', 'created_at'],
							},
						},
					},
				},
			},
		};
		const db = createSequentialMockDb([activeUser], [role]);
		const service = new PermissionService(db, cache);

		const result = await service.evaluate(baseParams);

		expect(result.allowed).toBe(true);
		expect(result.fieldAccess).toEqual({
			hidden: ['ssn', 'salary'],
			readOnly: ['email', 'created_at'],
		});
	});

	it('denies update when user is not the record owner ($current_user filter)', async () => {
		const activeUser = { id: 'user-1', status: 'active', teamId: 'team-1' };
		const role = {
			id: 'role-1',
			permissions: {
				sales: {
					tables: {
						contacts: {
							actions: ['read', 'update'],
							record_filters: {
								write: { created_by: '$current_user' },
							},
						},
					},
				},
			},
		};
		const db = createSequentialMockDb([activeUser], [role]);
		const service = new PermissionService(db, cache);

		const result = await service.evaluate({
			...baseParams,
			action: 'update',
			recordOwnerId: 'other-user-id',
		});

		expect(result.allowed).toBe(false);
		expect(result.layer).toBe(5);
		expect(result.reason).toBe('Can only modify own records');
	});

	it('allows update when user is the record owner', async () => {
		const activeUser = { id: 'user-1', status: 'active', teamId: 'team-1' };
		const role = {
			id: 'role-1',
			permissions: {
				sales: {
					tables: {
						contacts: {
							actions: ['read', 'update'],
							record_filters: {
								write: { created_by: '$current_user' },
							},
						},
					},
				},
			},
		};
		const db = createSequentialMockDb([activeUser], [role]);
		const service = new PermissionService(db, cache);

		const result = await service.evaluate({
			...baseParams,
			action: 'update',
			recordOwnerId: 'user-1',
		});

		expect(result.allowed).toBe(true);
		expect(result.layer).toBe(6);
		expect(result.reason).toBe('Permitted');
	});

	// ── Configurable Record Filter Tests ──

	it('denies update when $current_team filter does not match recordData', async () => {
		const activeUser = { id: 'user-1', status: 'active', teamId: 'team-1' };
		const role = {
			id: 'role-1',
			permissions: {
				sales: {
					tables: {
						contacts: {
							actions: ['read', 'update'],
							record_filters: {
								write: { team_id: '$current_team' },
							},
						},
					},
				},
			},
		};
		const db = createSequentialMockDb([activeUser], [role]);
		const service = new PermissionService(db, cache);

		const result = await service.evaluate({
			...baseParams,
			action: 'update',
			recordData: { team_id: 'other-team' },
		});

		expect(result.allowed).toBe(false);
		expect(result.layer).toBe(5);
		expect(result.reason).toContain('Record filter denied');
	});

	it('allows update when $current_team filter matches recordData', async () => {
		const activeUser = { id: 'user-1', status: 'active', teamId: 'team-1' };
		const role = {
			id: 'role-1',
			permissions: {
				sales: {
					tables: {
						contacts: {
							actions: ['read', 'update'],
							record_filters: {
								write: { team_id: '$current_team' },
							},
						},
					},
				},
			},
		};
		const db = createSequentialMockDb([activeUser], [role]);
		const service = new PermissionService(db, cache);

		const result = await service.evaluate({
			...baseParams,
			action: 'update',
			recordData: { team_id: 'team-1' },
		});

		expect(result.allowed).toBe(true);
		expect(result.layer).toBe(6);
	});

	it('denies delete when $current_role filter does not match recordData', async () => {
		const activeUser = { id: 'user-1', status: 'active', teamId: 'team-1' };
		const role = {
			id: 'role-1',
			permissions: {
				sales: {
					tables: {
						contacts: {
							actions: ['read', 'update', 'delete'],
							record_filters: {
								write: { assigned_role: '$current_role' },
							},
						},
					},
				},
			},
		};
		const db = createSequentialMockDb([activeUser], [role]);
		const service = new PermissionService(db, cache);

		const result = await service.evaluate({
			...baseParams,
			action: 'delete',
			recordData: { assigned_role: 'other-role' },
		});

		expect(result.allowed).toBe(false);
		expect(result.layer).toBe(5);
	});

	it('allows delete when $current_role filter matches recordData', async () => {
		const activeUser = { id: 'user-1', status: 'active', teamId: 'team-1' };
		const role = {
			id: 'role-1',
			permissions: {
				sales: {
					tables: {
						contacts: {
							actions: ['read', 'update', 'delete'],
							record_filters: {
								write: { assigned_role: '$current_role' },
							},
						},
					},
				},
			},
		};
		const db = createSequentialMockDb([activeUser], [role]);
		const service = new PermissionService(db, cache);

		const result = await service.evaluate({
			...baseParams,
			action: 'delete',
			recordData: { assigned_role: 'role-1' },
		});

		expect(result.allowed).toBe(true);
		expect(result.layer).toBe(6);
	});

	it('allows read action even when write filter exists', async () => {
		const activeUser = { id: 'user-1', status: 'active', teamId: 'team-1' };
		const role = {
			id: 'role-1',
			permissions: {
				sales: {
					tables: {
						contacts: {
							actions: ['read', 'update'],
							record_filters: {
								write: { created_by: '$current_user' },
							},
						},
					},
				},
			},
		};
		const db = createSequentialMockDb([activeUser], [role]);
		const service = new PermissionService(db, cache);

		const result = await service.evaluate({
			...baseParams,
			action: 'read',
			recordOwnerId: 'other-user',
		});

		expect(result.allowed).toBe(true);
		expect(result.layer).toBe(6);
	});

	it('backward compat: created_by + $current_user still works with recordOwnerId', async () => {
		const activeUser = { id: 'user-1', status: 'active', teamId: 'team-1' };
		const role = {
			id: 'role-1',
			permissions: {
				sales: {
					tables: {
						contacts: {
							actions: ['read', 'update'],
							record_filters: {
								write: { created_by: '$current_user' },
							},
						},
					},
				},
			},
		};
		const db = createSequentialMockDb([activeUser], [role]);
		const service = new PermissionService(db, cache);

		const result = await service.evaluate({
			...baseParams,
			action: 'update',
			recordOwnerId: 'user-1',
		});

		expect(result.allowed).toBe(true);
	});

	it('allows update when no write filter exists in record_filters', async () => {
		const activeUser = { id: 'user-1', status: 'active', teamId: 'team-1' };
		const role = {
			id: 'role-1',
			permissions: {
				sales: {
					tables: {
						contacts: {
							actions: ['read', 'update'],
							record_filters: {},
						},
					},
				},
			},
		};
		const db = createSequentialMockDb([activeUser], [role]);
		const service = new PermissionService(db, cache);

		const result = await service.evaluate({
			...baseParams,
			action: 'update',
			recordOwnerId: 'other-user',
		});

		expect(result.allowed).toBe(true);
		expect(result.layer).toBe(6);
	});
});
