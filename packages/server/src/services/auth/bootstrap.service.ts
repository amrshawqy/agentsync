import crypto from 'node:crypto';
import type { Database } from '@agentsync/db';
import { accounts, setupTokens } from '@agentsync/db';
import { and, eq, isNull } from 'drizzle-orm';
import { getConfig } from '../../config.js';
import { logger } from '../../infra/logger.js';
import type { AccountService } from './account.service.js';

const SETUP_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

function hash(value: string): string {
	return crypto.createHash('sha256').update(value).digest('hex');
}

export class BootstrapService {
	constructor(
		private db: Database,
		private account: AccountService,
	) {}

	/**
	 * Called once at server startup. If no super-admin exists yet AND no
	 * `BOOTSTRAP_ADMIN_EMAIL` is configured, mints a one-time setup token
	 * and prints it to logs so an operator can elevate themselves via
	 * `POST /v1/auth/setup/redeem`.
	 */
	async onServerStart(): Promise<void> {
		const config = getConfig();
		const hasSuper = await this.account.hasAnySuperAdmin();
		if (hasSuper) {
			return;
		}
		if (config.BOOTSTRAP_ADMIN_EMAIL) {
			logger.info('bootstrap admin: waiting for sign-up matching BOOTSTRAP_ADMIN_EMAIL', {
				email: config.BOOTSTRAP_ADMIN_EMAIL,
			});
			return;
		}
		const token = await this.mintSetupToken();
		logger.warn(
			'bootstrap admin: no super-admin exists and BOOTSTRAP_ADMIN_EMAIL is not set. ' +
				'Use this one-time setup token (valid 24h) at POST /v1/auth/setup/redeem:',
			{ setupToken: token },
		);
	}

	private async mintSetupToken(): Promise<string> {
		const token = crypto.randomBytes(24).toString('base64url');
		const expiresAt = new Date(Date.now() + SETUP_TOKEN_TTL_MS);
		await this.db.insert(setupTokens).values({
			tokenHash: hash(token),
			expiresAt,
		});
		return token;
	}

	/**
	 * Apply bootstrap admin promotion when an account is created or its email
	 * is updated. If `BOOTSTRAP_ADMIN_EMAIL` matches and no super-admin exists
	 * yet, the account is promoted.
	 */
	async maybePromoteByEmail(accountId: string, email: string | null | undefined): Promise<boolean> {
		if (!email) return false;
		const config = getConfig();
		if (!config.BOOTSTRAP_ADMIN_EMAIL) return false;
		if (email.toLowerCase() !== config.BOOTSTRAP_ADMIN_EMAIL.toLowerCase()) return false;
		const hasSuper = await this.account.hasAnySuperAdmin();
		if (hasSuper) return false;
		await this.account.setSuperAdmin(accountId, true);
		logger.info('bootstrap admin: promoted account via BOOTSTRAP_ADMIN_EMAIL', {
			accountId,
			email,
		});
		return true;
	}

	/** Redeem a setup token: promotes the supplied account to super-admin. */
	async redeemSetupToken(
		token: string,
		accountId: string,
	): Promise<{ ok: true } | { ok: false; reason: string }> {
		const [row] = await this.db
			.select()
			.from(setupTokens)
			.where(and(eq(setupTokens.tokenHash, hash(token)), isNull(setupTokens.consumedAt)));
		if (!row) return { ok: false, reason: 'invalid_or_used_token' };
		if (new Date() > row.expiresAt) return { ok: false, reason: 'token_expired' };

		await this.db
			.update(setupTokens)
			.set({ consumedAt: new Date(), consumedByAccountId: accountId })
			.where(eq(setupTokens.id, row.id));

		await this.account.setSuperAdmin(accountId, true);
		logger.info('bootstrap admin: promoted account via setup token', { accountId });
		return { ok: true };
	}

	async getAccountByEmail(email: string) {
		const [row] = await this.db
			.select()
			.from(accounts)
			.where(eq(accounts.primaryEmail, email.toLowerCase()));
		return row ?? null;
	}
}
