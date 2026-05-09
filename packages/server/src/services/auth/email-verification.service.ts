import crypto from 'node:crypto';
import type { Database } from '@agentsync/db';
import { accounts, emailOtpChallenges } from '@agentsync/db';
import { and, eq } from 'drizzle-orm';
import { getConfig } from '../../config.js';
import { logger } from '../../infra/logger.js';
import type { EmailService } from '../email/email.service.js';

function hashOtp(value: string): string {
	return crypto.createHash('sha256').update(value).digest('hex');
}

function maskEmail(email: string): string {
	const [local, domain] = email.split('@');
	if (!local || !domain) return email;
	if (local.length <= 2) return `${local[0] ?? '*'}*@${domain}`;
	return `${local[0]}${'*'.repeat(Math.max(1, local.length - 2))}${local[local.length - 1]}@${domain}`;
}

export class EmailVerificationService {
	constructor(
		private db: Database,
		private email: EmailService,
	) {}

	async start(accountId: string, email: string) {
		const config = getConfig();
		const normalizedEmail = email.toLowerCase();
		const otp = String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0');
		const expiresAt = new Date(Date.now() + config.EMAIL_OTP_EXPIRY_MINUTES * 60_000);

		const [challenge] = await this.db
			.insert(emailOtpChallenges)
			.values({
				accountId,
				email: normalizedEmail,
				otpHash: hashOtp(otp),
				expiresAt,
			})
			.returning();

		await this.sendOtp(normalizedEmail, otp);

		return {
			challengeId: challenge.id,
			expiresAt,
			maskedEmail: maskEmail(normalizedEmail),
		};
	}

	async verify(accountId: string, challengeId: string, otp: string) {
		const config = getConfig();
		const [challenge] = await this.db
			.select()
			.from(emailOtpChallenges)
			.where(
				and(eq(emailOtpChallenges.id, challengeId), eq(emailOtpChallenges.accountId, accountId)),
			);

		if (!challenge) {
			throw new Error('OTP challenge not found');
		}
		if (challenge.consumedAt) {
			throw new Error('OTP already used');
		}
		if (new Date() > challenge.expiresAt) {
			throw new Error('OTP expired');
		}
		if (challenge.attemptCount >= config.EMAIL_OTP_MAX_ATTEMPTS) {
			throw new Error('Too many OTP attempts');
		}

		if (challenge.otpHash !== hashOtp(otp)) {
			await this.db
				.update(emailOtpChallenges)
				.set({ attemptCount: challenge.attemptCount + 1 })
				.where(eq(emailOtpChallenges.id, challenge.id));
			throw new Error('Invalid OTP');
		}

		await this.db
			.update(emailOtpChallenges)
			.set({
				consumedAt: new Date(),
				attemptCount: challenge.attemptCount + 1,
			})
			.where(eq(emailOtpChallenges.id, challenge.id));

		const [updatedAccount] = await this.db
			.update(accounts)
			.set({
				primaryEmail: challenge.email,
				emailVerifiedAt: new Date(),
				limitsTier: 'verified',
				updatedAt: new Date(),
			})
			.where(eq(accounts.id, accountId))
			.returning();

		return updatedAccount;
	}

	private async sendOtp(email: string, otp: string): Promise<void> {
		const config = getConfig();
		try {
			await this.email.send({
				to: email,
				subject: 'Your AgentSync verification code',
				text: `Your AgentSync verification code is ${otp}. It expires in ${config.EMAIL_OTP_EXPIRY_MINUTES} minutes.`,
			});
		} catch (err) {
			logger.error('Failed to send OTP email', { error: String(err) });
			throw new Error('Failed to send verification email');
		}
	}
}
