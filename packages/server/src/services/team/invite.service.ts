import crypto from 'node:crypto';
import type { Database } from '@agentsync/db';
import { accounts, teamInvites, users } from '@agentsync/db';
import { and, eq, gte, sql } from 'drizzle-orm';
import { getConfig } from '../../config.js';
import { logger } from '../../infra/logger.js';
import type { EmailService } from '../email/email.service.js';

function hashToken(value: string): string {
	return crypto.createHash('sha256').update(value).digest('hex');
}

export class InviteService {
	constructor(
		private db: Database,
		private email: EmailService,
	) {}

	async createInvite(params: {
		teamId: string;
		roleId: string;
		invitedByUserId: string;
		email?: string;
		expiresInDays?: number;
	}) {
		const config = getConfig();
		const [inviter] = await this.db
			.select()
			.from(users)
			.where(eq(users.id, params.invitedByUserId));
		if (!inviter || inviter.teamId !== params.teamId) {
			throw new Error('Inviter not found in team');
		}

		let maxInvites = config.UNVERIFIED_MAX_INVITES_PER_DAY;
		if (inviter.accountId) {
			const [account] = await this.db
				.select()
				.from(accounts)
				.where(eq(accounts.id, inviter.accountId));
			if (account?.limitsTier === 'verified') {
				maxInvites = config.VERIFIED_MAX_INVITES_PER_DAY;
			}
		}

		const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
		const [inviteCount] = await this.db
			.select({ count: sql<number>`count(*)` })
			.from(teamInvites)
			.where(
				and(
					eq(teamInvites.teamId, params.teamId),
					eq(teamInvites.invitedByUserId, params.invitedByUserId),
					gte(teamInvites.createdAt, since),
				),
			);
		if (Number(inviteCount?.count ?? 0) >= maxInvites) {
			throw new Error('Daily invite limit reached for this account tier');
		}

		const inviteCode = crypto.randomBytes(24).toString('base64url');
		const tokenHash = hashToken(inviteCode);
		const expiresInDays = Math.min(Math.max(params.expiresInDays ?? 7, 1), 30);
		const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

		const [invite] = await this.db
			.insert(teamInvites)
			.values({
				teamId: params.teamId,
				roleId: params.roleId,
				invitedByUserId: params.invitedByUserId,
				email: params.email?.toLowerCase(),
				tokenHash,
				expiresAt,
			})
			.returning();

		const inviteLink = `${config.PUBLIC_BASE_URL}/invite/${inviteCode}`;
		if (params.email) {
			await this.sendInviteEmail(params.email, inviteLink).catch((err) => {
				logger.warn('Failed to send invite email', { error: String(err) });
			});
		}

		return {
			invite,
			inviteCode,
			inviteLink,
		};
	}

	async acceptInvite(params: { accountId: string; inviteCode: string }) {
		const tokenHash = hashToken(params.inviteCode);
		const [invite] = await this.db
			.select()
			.from(teamInvites)
			.where(and(eq(teamInvites.tokenHash, tokenHash), eq(teamInvites.status, 'pending')));

		if (!invite) {
			throw new Error('Invite not found');
		}

		if (invite.revokedAt) {
			throw new Error('Invite has been revoked');
		}
		if (new Date() > invite.expiresAt) {
			await this.db
				.update(teamInvites)
				.set({ status: 'expired' })
				.where(eq(teamInvites.id, invite.id));
			throw new Error('Invite expired');
		}

		const [account] = await this.db
			.select()
			.from(accounts)
			.where(eq(accounts.id, params.accountId));
		if (!account) {
			throw new Error('Account not found');
		}

		if (invite.email && account.primaryEmail && invite.email !== account.primaryEmail) {
			throw new Error('Invite email does not match account email');
		}

		const [existingMembership] = await this.db
			.select()
			.from(users)
			.where(and(eq(users.accountId, params.accountId), eq(users.teamId, invite.teamId)));

		let membership = existingMembership;
		if (existingMembership) {
			const [updated] = await this.db
				.update(users)
				.set({
					status: 'active',
					roleId: invite.roleId,
				})
				.where(eq(users.id, existingMembership.id))
				.returning();
			membership = updated;
		} else {
			const fallbackEmail =
				invite.email ?? account.primaryEmail ?? `${account.id.slice(0, 12)}@agent.local`;
			const [created] = await this.db
				.insert(users)
				.values({
					accountId: account.id,
					teamId: invite.teamId,
					roleId: invite.roleId,
					email: fallbackEmail,
					status: 'active',
				})
				.returning();
			membership = created;
		}

		await this.db
			.update(teamInvites)
			.set({
				status: 'accepted',
				acceptedAt: new Date(),
			})
			.where(eq(teamInvites.id, invite.id));

		return {
			inviteId: invite.id,
			teamId: invite.teamId,
			roleId: invite.roleId,
			membership,
		};
	}

	private async sendInviteEmail(email: string, inviteLink: string): Promise<void> {
		await this.email.send({
			to: email,
			subject: 'You were invited to an AgentSync team',
			text: `You have been invited to join an AgentSync team.\n\nOpen this link to accept:\n${inviteLink}\n`,
			html: `<p>You have been invited to join an AgentSync team.</p><p>Open this link to accept:<br/><a href="${inviteLink}">${inviteLink}</a></p>`,
		});
	}
}
