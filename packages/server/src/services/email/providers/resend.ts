import type { EmailMessage, EmailProvider } from '../types.js';

export interface ResendOptions {
	apiKey: string;
	from: string;
}

export class ResendEmailProvider implements EmailProvider {
	readonly name = 'resend';

	constructor(private opts: ResendOptions) {}

	async send(message: EmailMessage): Promise<void> {
		const res = await fetch('https://api.resend.com/emails', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${this.opts.apiKey}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				from: this.opts.from,
				to: [message.to],
				subject: message.subject,
				text: message.text,
				html: message.html,
			}),
		});

		if (!res.ok) {
			const payload = await res.text();
			throw new Error(`Resend send failed (${res.status}): ${payload}`);
		}
	}

	async healthCheck() {
		// Resend has no cheap health endpoint; treat configured key as healthy.
		return { ok: Boolean(this.opts.apiKey && this.opts.from) };
	}
}
