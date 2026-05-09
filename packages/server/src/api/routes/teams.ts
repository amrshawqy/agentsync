import { Hono } from 'hono';
import { getConfig } from '../../config.js';
import type { ServiceContainer } from '../../services/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/route-authz.js';

const TEAM_SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const RESERVED_SLUGS = new Set(['admin', 'api', 'support', 'www', 'status', 'help', 'root']);

async function resolveAccountId(c: { get: (key: string) => unknown }, services: ServiceContainer) {
	const accountId = c.get('accountId') as string | undefined;
	if (accountId) return accountId;

	const userId = c.get('userId') as string | undefined;
	if (!userId) return null;
	return services.account.ensureAccountForMembership(userId);
}

export function createTeamRoutes(services: ServiceContainer): Hono {
	const app = new Hono();
	app.use('/*', authMiddleware);

	app.get('/', async (c) => {
		const accountId = await resolveAccountId(c, services);
		if (!accountId) {
			return c.json({ error: { code: 'UNAUTHORIZED', message: 'Account context missing' } }, 401);
		}

		const memberships = await services.account.listMemberships(accountId);
		return c.json({ success: true, data: memberships });
	});

	app.post('/', async (c) => {
		const accountId = await resolveAccountId(c, services);
		if (!accountId) {
			return c.json({ error: { code: 'UNAUTHORIZED', message: 'Account context missing' } }, 401);
		}

		const account = await services.account.getById(accountId);
		if (!account) {
			return c.json({ error: { code: 'UNAUTHORIZED', message: 'Account not found' } }, 401);
		}

		const body = await c.req.json();
		const name = String(body.name ?? '').trim();
		const slug = String(body.slug ?? '')
			.trim()
			.toLowerCase();
		if (!name || !slug) {
			return c.json(
				{ error: { code: 'INVALID_REQUEST', message: 'name and slug are required' } },
				400,
			);
		}
		if (
			!TEAM_SLUG_REGEX.test(slug) ||
			slug.length < 3 ||
			slug.length > 32 ||
			RESERVED_SLUGS.has(slug)
		) {
			return c.json(
				{ error: { code: 'INVALID_SLUG', message: 'Team slug is invalid or reserved' } },
				400,
			);
		}

		const config = getConfig();
		if (account.limitsTier !== 'verified') {
			const membershipCount = await services.account.countMemberships(accountId);
			if (membershipCount >= config.UNVERIFIED_MAX_TEAMS) {
				return c.json(
					{
						error: {
							code: 'LIMIT_EXCEEDED',
							message:
								'Unverified account reached max team limit. Verify email to unlock higher limits.',
						},
					},
					403,
				);
			}
		}

		const existing = await services.team.getBySlug(slug);
		if (existing) {
			return c.json({ error: { code: 'CONFLICT', message: 'Team slug already exists' } }, 409);
		}

		const team = await services.team.create({ name, slug });
		const adminRole = await services.team.getRoleByName(team.id, 'admin');
		const roleId = adminRole?.id;
		if (!roleId) {
			return c.json(
				{ error: { code: 'INTERNAL_ERROR', message: 'Admin role missing on new team' } },
				500,
			);
		}

		const membershipEmail = account.primaryEmail ?? `${account.id.slice(0, 12)}@agent.local`;
		const membership = await services.user.create(team.id, {
			accountId,
			email: membershipEmail,
			roleId,
		});
		await services.user.update(membership.id, { status: 'active' });

		const teamToken = await services.agentIdentity.issueTeamToken({
			accountId,
			teamId: team.id,
			agentId: c.get('agentId'),
		});

		return c.json(
			{
				success: true,
				data: {
					team,
					membership: { ...membership, status: 'active' },
					accessToken: teamToken.accessToken,
					expiresIn: teamToken.expiresIn,
				},
			},
			201,
		);
	});

	app.post('/:teamId/invites', async (c) => {
		const denied = await requireAdmin(c, services);
		if (denied) return denied;

		const teamId = c.req.param('teamId');
		const currentTeamId = c.get('teamId');
		if (teamId !== currentTeamId) {
			return c.json(
				{ error: { code: 'FORBIDDEN', message: 'Cannot create invites for another team' } },
				403,
			);
		}

		const body = await c.req.json();
		const email = (body.email as string | undefined)?.toLowerCase();
		let roleId = body.roleId as string | undefined;
		if (!roleId) {
			roleId = (await services.team.getRoleByName(teamId, 'member'))?.id;
		}
		if (!roleId) {
			return c.json({ error: { code: 'INVALID_REQUEST', message: 'roleId is required' } }, 400);
		}

		const invite = await services.invite.createInvite({
			teamId,
			roleId,
			invitedByUserId: c.get('userId'),
			email,
			expiresInDays: body.expiresInDays as number | undefined,
		});

		return c.json({ success: true, data: invite }, 201);
	});

	app.post('/invites/accept', async (c) => {
		const accountId = await resolveAccountId(c, services);
		if (!accountId) {
			return c.json({ error: { code: 'UNAUTHORIZED', message: 'Account context missing' } }, 401);
		}

		const body = await c.req.json();
		const inviteCode = body.inviteCode as string | undefined;
		if (!inviteCode) {
			return c.json({ error: { code: 'INVALID_REQUEST', message: 'inviteCode is required' } }, 400);
		}

		try {
			const accepted = await services.invite.acceptInvite({ accountId, inviteCode });
			const teamToken = await services.agentIdentity.issueTeamToken({
				accountId,
				teamId: accepted.teamId,
				agentId: c.get('agentId'),
			});
			return c.json({
				success: true,
				data: {
					...accepted,
					accessToken: teamToken.accessToken,
					expiresIn: teamToken.expiresIn,
				},
			});
		} catch (err) {
			return c.json({ error: { code: 'INVITE_INVALID', message: String(err) } }, 400);
		}
	});

	app.post('/:teamId/switch', async (c) => {
		const accountId = await resolveAccountId(c, services);
		if (!accountId) {
			return c.json({ error: { code: 'UNAUTHORIZED', message: 'Account context missing' } }, 401);
		}
		const teamId = c.req.param('teamId');
		try {
			const teamToken = await services.agentIdentity.issueTeamToken({
				accountId,
				teamId,
				agentId: c.get('agentId'),
			});
			return c.json({ success: true, data: teamToken });
		} catch (err) {
			return c.json({ error: { code: 'FORBIDDEN', message: String(err) } }, 403);
		}
	});

	app.get('/:teamId/memberships/me', async (c) => {
		const accountId = await resolveAccountId(c, services);
		if (!accountId) {
			return c.json({ error: { code: 'UNAUTHORIZED', message: 'Account context missing' } }, 401);
		}
		const membership = await services.user.getByAccountAndTeam(accountId, c.req.param('teamId'));
		if (!membership) {
			return c.json({ error: { code: 'NOT_FOUND', message: 'Membership not found' } }, 404);
		}
		return c.json({ success: true, data: membership });
	});

	return app;
}
