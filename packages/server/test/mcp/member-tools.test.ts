import { beforeAll, describe, expect, it } from 'vitest';
import { registerTools } from '../../src/mcp/tools/index.js';
import {
	createAuthContextGetter,
	createMockMcpServer,
	createMockServiceContainer,
	getResultJson,
	getResultText,
} from './setup.js';

describe('Member & Permission MCP tools', () => {
	const mcp = createMockMcpServer();
	const services = createMockServiceContainer();
	const getAuth = createAuthContextGetter();

	beforeAll(() => {
		registerTools(mcp as any, services as any, getAuth);
	});

	// ── list_members ──

	describe('list_members', () => {
		it('should return team members', async () => {
			services.user.listByTeam.mockResolvedValueOnce([
				{ id: 'user-1', email: 'admin@test.com', name: 'Admin' },
				{ id: 'user-2', email: 'dev@test.com', name: 'Developer' },
			]);

			const result = await mcp.invokeTool('list_members', {});
			const json = getResultJson(result) as any[];

			expect(json).toHaveLength(2);
			expect(json[0]).toMatchObject({ id: 'user-1', email: 'admin@test.com' });
			expect(json[1]).toMatchObject({ id: 'user-2', email: 'dev@test.com' });
			expect(services.user.listByTeam).toHaveBeenCalledWith('team-test-1');
		});

		it('should return empty array when no members exist', async () => {
			services.user.listByTeam.mockResolvedValueOnce([]);

			const result = await mcp.invokeTool('list_members', {});
			const json = getResultJson(result) as any[];

			expect(json).toEqual([]);
		});
	});

	// ── add_member ──

	describe('add_member', () => {
		it('should add a new member with email and name', async () => {
			services.user.create.mockResolvedValueOnce({
				id: 'user-new',
				email: 'new@test.com',
				name: 'New User',
			});

			const result = await mcp.invokeTool('add_member', {
				email: 'new@test.com',
				name: 'New User',
			});
			const json = getResultJson(result) as any;

			expect(json).toMatchObject({ id: 'user-new', email: 'new@test.com', name: 'New User' });
			expect(services.user.create).toHaveBeenCalledWith('team-test-1', {
				email: 'new@test.com',
				name: 'New User',
			});
		});

		it('should add a member with a specific role', async () => {
			const roleId = '00000000-0000-0000-0000-000000000001';
			services.user.create.mockResolvedValueOnce({
				id: 'user-new',
				email: 'member@test.com',
				roleId,
			});

			const result = await mcp.invokeTool('add_member', {
				email: 'member@test.com',
				roleId,
			});
			const json = getResultJson(result) as any;

			expect(json.roleId).toBe(roleId);
			expect(services.user.create).toHaveBeenCalledWith('team-test-1', {
				email: 'member@test.com',
				roleId,
			});
		});
	});

	// ── update_member_role ──

	describe('update_member_role', () => {
		it('should update a member role', async () => {
			const userId = '00000000-0000-0000-0000-000000000010';
			const roleId = '00000000-0000-0000-0000-000000000020';
			services.user.update.mockResolvedValueOnce({ id: userId, roleId });

			const result = await mcp.invokeTool('update_member_role', { userId, roleId });
			const json = getResultJson(result) as any;

			expect(json).toMatchObject({ id: userId, roleId });
			expect(services.user.update).toHaveBeenCalledWith(userId, { roleId });
		});
	});

	// ── create_role ──

	describe('create_role', () => {
		it('should create a new role with permissions', async () => {
			const permissions = { 'record.read': true, 'record.write': true };
			services.team.createRole.mockResolvedValueOnce({
				id: 'role-new',
				name: 'editor',
				permissions,
			});

			const result = await mcp.invokeTool('create_role', {
				name: 'editor',
				permissions,
			});
			const json = getResultJson(result) as any;

			expect(json).toMatchObject({ id: 'role-new', name: 'editor' });
			expect(services.team.createRole).toHaveBeenCalledWith('team-test-1', 'editor', permissions);
		});

		it('should create a role with empty permissions', async () => {
			services.team.createRole.mockResolvedValueOnce({
				id: 'role-readonly',
				name: 'viewer',
			});

			const result = await mcp.invokeTool('create_role', {
				name: 'viewer',
				permissions: {},
			});
			const json = getResultJson(result) as any;

			expect(json.name).toBe('viewer');
			expect(services.team.createRole).toHaveBeenCalledWith('team-test-1', 'viewer', {});
		});
	});

	// ── set_field_access ──

	describe('set_field_access', () => {
		it('should set hidden and readOnly fields for a role', async () => {
			const roleId = '00000000-0000-0000-0000-000000000030';
			services.team.updateRoleFieldAccess.mockResolvedValueOnce({ id: roleId });

			const result = await mcp.invokeTool('set_field_access', {
				roleId,
				workspace: 'crm',
				table: 'contacts',
				hidden: ['ssn', 'internal_notes'],
				readOnly: ['email', 'created_at'],
			});
			const json = getResultJson(result) as any;

			expect(json).toMatchObject({ id: roleId });
			expect(services.team.updateRoleFieldAccess).toHaveBeenCalledWith(roleId, 'crm', 'contacts', {
				hidden: ['ssn', 'internal_notes'],
				readOnly: ['email', 'created_at'],
			});
		});

		it('should set only hidden fields without readOnly', async () => {
			const roleId = '00000000-0000-0000-0000-000000000031';
			services.team.updateRoleFieldAccess.mockResolvedValueOnce({ id: roleId });

			const result = await mcp.invokeTool('set_field_access', {
				roleId,
				workspace: 'crm',
				table: 'contacts',
				hidden: ['ssn'],
			});

			expect(result.isError).toBeUndefined();
			expect(services.team.updateRoleFieldAccess).toHaveBeenCalledWith(roleId, 'crm', 'contacts', {
				hidden: ['ssn'],
				readOnly: undefined,
			});
		});
	});
});
