import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import type { EmailMessage, EmailProvider } from '../types.js';

export interface SesOptions {
	region: string;
	from: string;
	accessKeyId?: string;
	secretAccessKey?: string;
}

export class SesEmailProvider implements EmailProvider {
	readonly name = 'ses';
	private client: SESClient;

	constructor(private opts: SesOptions) {
		this.client = new SESClient({
			region: opts.region,
			credentials:
				opts.accessKeyId && opts.secretAccessKey
					? { accessKeyId: opts.accessKeyId, secretAccessKey: opts.secretAccessKey }
					: undefined,
		});
	}

	async send(message: EmailMessage): Promise<void> {
		const command = new SendEmailCommand({
			Source: this.opts.from,
			Destination: { ToAddresses: [message.to] },
			Message: {
				Subject: { Data: message.subject, Charset: 'UTF-8' },
				Body: {
					Text: { Data: message.text, Charset: 'UTF-8' },
					...(message.html ? { Html: { Data: message.html, Charset: 'UTF-8' } } : {}),
				},
			},
		});
		await this.client.send(command);
	}

	async healthCheck() {
		// AWS SES has no zero-cost ping; treat configured client as healthy.
		return { ok: Boolean(this.opts.region && this.opts.from) };
	}
}
