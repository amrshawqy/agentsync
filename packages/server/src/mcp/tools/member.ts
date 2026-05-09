import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ToolHelpers } from './shared.js';

export function registerMemberTools(mcp: McpServer, h: ToolHelpers) {
	const { services, getCtx, resolveAccountId, requireAdmin } = h;

	mcp.tool('list_members', 'List team members', {}, async (_args, extra) => {
		const ctx = getCtx(extra);
		const denied = await requireAdmin(ctx);
		if (denied) return denied;

		const members = await services.user.listByTeam(ctx.teamId);
		return { content: [{ type: 'text', text: JSON.stringify(members, null, 2) }] };
	});

	mcp.tool(
		'add_member',
		'Add a new member to the team',
		{
			email: z.string().email(),
			name: z.string().optional(),
			roleId: z.string().uuid().optional(),
		},
		async (args, extra) => {
			const ctx = getCtx(extra);
			const denied = await requireAdmin(ctx);
			if (denied) return denied;

			const member = await services.user.create(ctx.teamId, args);
			return { content: [{ type: 'text', text: JSON.stringify(member, null, 2) }] };
		},
	);

	mcp.tool(
		'update_member_role',
		"Change a member's role",
		{
			userId: z.string().uuid(),
			roleId: z.string().uuid(),
		},
		async (args, extra) => {
			const ctx = getCtx(extra);
			const denied = await requireAdmin(ctx);
			if (denied) return denied;

			const updated = await services.user.update(args.userId, { roleId: args.roleId });
			return { content: [{ type: 'text', text: JSON.stringify(updated, null, 2) }] };
		},
	);

	mcp.tool(
		'create_role',
		'Create a new role with permissions',
		{
			name: z.string(),
			permissions: z.record(z.unknown()),
		},
		async (args, extra) => {
			const ctx = getCtx(extra);
			const denied = await requireAdmin(ctx);
			if (denied) return denied;

			const role = await services.team.createRole(ctx.teamId, args.name, args.permissions);
			return { content: [{ type: 'text', text: JSON.stringify(role, null, 2) }] };
		},
	);

	mcp.tool(
		'set_field_access',
		'Configure field-level access for a role on a table',
		{
			roleId: z.string().uuid(),
			workspace: z.string(),
			table: z.string(),
			hidden: z.array(z.string()).optional(),
			readOnly: z.array(z.string()).optional(),
		},
		async (args, extra) => {
			const ctx = getCtx(extra);
			const denied = await requireAdmin(ctx);
			if (denied) return denied;

			const updated = await services.team.updateRoleFieldAccess(
				args.roleId,
				args.workspace,
				args.table,
				{ hidden: args.hidden, readOnly: args.readOnly },
			);
			return { content: [{ type: 'text', text: JSON.stringify(updated, null, 2) }] };
		},
	);

	mcp.tool(
		'invite_member',
		'Create a team invite code for a new member',
		{
			email: z.string().email().optional(),
			roleId: z.string().uuid().optional(),
			expiresInDays: z.number().int().min(1).max(30).optional(),
		},
		async (args, extra) => {
			const ctx = getCtx(extra);
			const denied = await requireAdmin(ctx);
			if (denied) return denied;

			const roleId = args.roleId ?? (await services.team.getRoleByName(ctx.teamId, 'member'))?.id;
			if (!roleId)
				return { content: [{ type: 'text', text: 'roleId is required' }], isError: true };

			const invite = await services.invite.createInvite({
				teamId: ctx.teamId,
				roleId,
				invitedByUserId: ctx.userId,
				email: args.email,
				expiresInDays: args.expiresInDays,
			});
			return { content: [{ type: 'text', text: JSON.stringify(invite, null, 2) }] };
		},
	);

	mcp.tool(
		'accept_team_invite',
		'Accept a team invite code and join the team',
		{
			inviteCode: z.string(),
		},
		async (args, extra) => {
			const ctx = getCtx(extra);
			const accountId = await resolveAccountId(ctx);
			if (!accountId)
				return { content: [{ type: 'text', text: 'No account context in token' }], isError: true };

			const accepted = await services.invite.acceptInvite({
				accountId,
				inviteCode: args.inviteCode,
			});
			const teamToken = await services.agentIdentity.issueTeamToken({
				accountId,
				teamId: accepted.teamId,
				agentId: ctx.agentId,
			});
			return {
				content: [
					{
						type: 'text',
						text: JSON.stringify({ ...accepted, accessToken: teamToken.accessToken }, null, 2),
					},
				],
			};
		},
	);
}
