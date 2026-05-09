import { getConfig } from '../../config.js';
import { logger } from '../../infra/logger.js';
import { ConsoleEmailProvider } from './providers/console.js';
import { ResendEmailProvider } from './providers/resend.js';
import { SesEmailProvider } from './providers/ses.js';
import { SmtpEmailProvider } from './providers/smtp.js';
import type { EmailMessage, EmailProvider } from './types.js';

export class EmailService {
	private provider: EmailProvider;

	constructor(provider?: EmailProvider) {
		this.provider = provider ?? createProviderFromConfig();
	}

	get providerName(): string {
		return this.provider.name;
	}

	async send(message: EmailMessage): Promise<void> {
		try {
			await this.provider.send(message);
		} catch (err) {
			logger.error('email send failed', {
				provider: this.provider.name,
				to: message.to,
				subject: message.subject,
				error: String(err),
			});
			throw err;
		}
	}

	async healthCheck() {
		if (!this.provider.healthCheck) return { ok: true };
		return this.provider.healthCheck();
	}
}

function createProviderFromConfig(): EmailProvider {
	const config = getConfig();
	const choice = config.EMAIL_PROVIDER;

	switch (choice) {
		case 'resend': {
			if (!config.RESEND_API_KEY || !config.EMAIL_FROM) {
				logger.warn(
					'EMAIL_PROVIDER=resend but RESEND_API_KEY/EMAIL_FROM not set; falling back to console',
				);
				return new ConsoleEmailProvider();
			}
			return new ResendEmailProvider({
				apiKey: config.RESEND_API_KEY,
				from: config.EMAIL_FROM,
			});
		}
		case 'smtp': {
			if (!config.SMTP_HOST || !config.EMAIL_FROM) {
				logger.warn(
					'EMAIL_PROVIDER=smtp but SMTP_HOST/EMAIL_FROM not set; falling back to console',
				);
				return new ConsoleEmailProvider();
			}
			return new SmtpEmailProvider({
				host: config.SMTP_HOST,
				port: config.SMTP_PORT,
				secure: config.SMTP_SECURE,
				user: config.SMTP_USER,
				password: config.SMTP_PASSWORD,
				from: config.EMAIL_FROM,
			});
		}
		case 'ses': {
			if (!config.EMAIL_FROM) {
				logger.warn('EMAIL_PROVIDER=ses but EMAIL_FROM not set; falling back to console');
				return new ConsoleEmailProvider();
			}
			return new SesEmailProvider({
				region: config.SES_REGION,
				from: config.EMAIL_FROM,
				accessKeyId: config.SES_ACCESS_KEY_ID,
				secretAccessKey: config.SES_SECRET_ACCESS_KEY,
			});
		}
		default:
			return new ConsoleEmailProvider();
	}
}
