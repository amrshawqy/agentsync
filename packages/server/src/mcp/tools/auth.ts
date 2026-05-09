import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { RESERVED_SLUGS, TEAM_SLUG_REGEX, type ToolHelpers } from './shared.js';

export function registerAuthTools(mcp: McpServer, h: ToolHelpers) {
	const { services, getCtx, resolveAccountId } = h;

	mcp.tool(
		'register_agent_identity',
		'Register an agent key identity. Call once without challengeId to receive challenge, then call with challengeId + signature.',
		{
			publicKeyJwk: z.record(z.unknown()),
			label: z.string().optional(),
			challengeId: z.string().uuid().optional(),
			signature: z.string().optional(),
			createAccountIfMissing: z.boolean().default(true),
		},
		async (args) => {
			if (!args.challengeId) {
				const challenge = await services.agentIdentity.createChallenge(
					args.publicKeyJwk,
					args.label,
				);
				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({ step: 'sign_challenge', ...challenge }, null, 2),
						},
					],
				};
			}
			if (!args.signature) {
				return {
					content: [{ type: 'text', text: 'signature is required when challengeId is provided' }],
					isError: true,
				};
			}

			const registration = await services.agentIdentity.registerFromChallenge({
				challengeId: args.challengeId,
				publicKeyJwk: args.publicKeyJwk,
				signature: args.signature,
				createAccountIfMissing: args.createAccountIfMissing,
			});
			const tokens = await services.agentIdentity.issueOnboardingTokens(
				registration.accountId,
				registration.agentId,
			);

			return {
				content: [
					{
						type: 'text',
						text: JSON.stringify(
							{
								accountId: registration.accountId,
								agentId: registration.agentId,
								accessToken: tokens.accessToken,
								refreshToken: tokens.refreshToken,
								expiresIn: tokens.expiresIn,
							},
							null,
							2,
						),
					},
				],
			};
		},
	);

	mcp.tool(
		'get_my_profile',
		'Get current account profile, team memberships, and linked agents',
		{},
		async (_args, extra) => {
			const ctx = getCtx(extra);
			const accountId = await resolveAccountId(ctx);
			if (!accountId)
				return { content: [{ type: 'text', text: 'No account context in token' }], isError: true };

			const profile = await services.agentIdentity.getProfile(accountId);
			if (!profile)
				return { content: [{ type: 'text', text: 'Account not found' }], isError: true };
			return { content: [{ type: 'text', text: JSON.stringify(profile, null, 2) }] };
		},
	);

	mcp.tool(
		'list_my_teams',
		'List the teams the current account belongs to',
		{},
		async (_args, extra) => {
			const ctx = getCtx(extra);
			const accountId = await resolveAccountId(ctx);
			if (!accountId)
				return { content: [{ type: 'text', text: 'No account context in token' }], isError: true };
			const memberships = await services.account.listMemberships(accountId);
			return { content: [{ type: 'text', text: JSON.stringify(memberships, null, 2) }] };
		},
	);

	mcp.tool(
		'create_team',
		'Create a new team and become its admin',
		{
			name: z.string().min(1).max(255),
			slug: z.string().min(3).max(32),
		},
		async (args, extra) => {
			const ctx = getCtx(extra);
			const accountId = await resolveAccountId(ctx);
			if (!accountId)
				return { content: [{ type: 'text', text: 'No account context in token' }], isError: true };

			const slug = args.slug.toLowerCase();
			if (!TEAM_SLUG_REGEX.test(slug) || RESERVED_SLUGS.has(slug)) {
				return {
					content: [{ type: 'text', text: 'Invalid or reserved team slug' }],
					isError: true,
				};
			}

			const account = await services.account.getById(accountId);
			if (!account)
				return { content: [{ type: 'text', text: 'Account not found' }], isError: true };

			if (account.limitsTier !== 'verified') {
				const memberships = await services.account.countMemberships(accountId);
				if (memberships >= 1) {
					return {
						content: [
							{
								type: 'text',
								text: 'Unverified accounts can only create one team. Verify email to unlock more.',
							},
						],
						isError: true,
					};
				}
			}

			const existing = await services.team.getBySlug(slug);
			if (existing)
				return { content: [{ type: 'text', text: 'Team slug already in use' }], isError: true };

			const team = await services.team.create({ name: args.name, slug });
			const adminRole = await services.team.getRoleByName(team.id, 'admin');
			if (!adminRole)
				return { content: [{ type: 'text', text: 'Failed to resolve admin role' }], isError: true };

			const membershipEmail = account.primaryEmail ?? `${account.id.slice(0, 12)}@agent.local`;
			const membership = await services.user.create(team.id, {
				accountId,
				email: membershipEmail,
				roleId: adminRole.id,
			});
			await services.user.update(membership.id, { status: 'active' });

			const teamToken = await services.agentIdentity.issueTeamToken({
				accountId,
				teamId: team.id,
				agentId: ctx.agentId,
			});

			return {
				content: [
					{
						type: 'text',
						text: JSON.stringify(
							{
								team,
								membership: { ...membership, status: 'active' },
								accessToken: teamToken.accessToken,
								expiresIn: teamToken.expiresIn,
							},
							null,
							2,
						),
					},
				],
			};
		},
	);

	mcp.tool(
		'switch_team',
		'Issue a team-scoped token for one of your teams',
		{
			teamId: z.string().uuid().optional(),
			teamSlug: z.string().optional(),
		},
		async (args, extra) => {
			const ctx = getCtx(extra);
			const accountId = await resolveAccountId(ctx);
			if (!accountId)
				return { content: [{ type: 'text', text: 'No account context in token' }], isError: true };

			let teamId = args.teamId;
			if (!teamId && args.teamSlug) {
				teamId = (await services.team.getBySlug(args.teamSlug))?.id;
			}
			if (!teamId)
				return { content: [{ type: 'text', text: 'Provide teamId or teamSlug' }], isError: true };

			const teamToken = await services.agentIdentity.issueTeamToken({
				accountId,
				teamId,
				agentId: ctx.agentId,
			});
			return { content: [{ type: 'text', text: JSON.stringify(teamToken, null, 2) }] };
		},
	);

	mcp.tool(
		'start_email_verification',
		'Start OTP verification for an email address (optional, unlocks higher limits)',
		{
			email: z.string().email(),
		},
		async (args, extra) => {
			const ctx = getCtx(extra);
			const accountId = await resolveAccountId(ctx);
			if (!accountId)
				return { content: [{ type: 'text', text: 'No account context in token' }], isError: true };
			const challenge = await services.emailVerification.start(accountId, args.email);
			return { content: [{ type: 'text', text: JSON.stringify(challenge, null, 2) }] };
		},
	);

	mcp.tool(
		'verify_email_otp',
		'Verify OTP code and upgrade account limits tier',
		{
			challengeId: z.string().uuid(),
			otp: z.string().regex(/^\d{6}$/),
		},
		async (args, extra) => {
			const ctx = getCtx(extra);
			const accountId = await resolveAccountId(ctx);
			if (!accountId)
				return { content: [{ type: 'text', text: 'No account context in token' }], isError: true };
			const updated = await services.emailVerification.verify(
				accountId,
				args.challengeId,
				args.otp,
			);
			return {
				content: [
					{
						type: 'text',
						text: JSON.stringify({ verified: true, limitsTier: updated?.limitsTier }, null, 2),
					},
				],
			};
		},
	);
}
