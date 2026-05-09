import nodemailer, { type Transporter } from 'nodemailer';
import type { EmailMessage, EmailProvider } from '../types.js';

export interface SmtpOptions {
	host: string;
	port: number;
	secure?: boolean;
	user?: string;
	password?: string;
	from: string;
}

export class SmtpEmailProvider implements EmailProvider {
	readonly name = 'smtp';
	private transport: Transporter;

	constructor(private opts: SmtpOptions) {
		this.transport = nodemailer.createTransport({
			host: opts.host,
			port: opts.port,
			secure: opts.secure ?? opts.port === 465,
			auth: opts.user && opts.password ? { user: opts.user, pass: opts.password } : undefined,
		});
	}

	async send(message: EmailMessage): Promise<void> {
		await this.transport.sendMail({
			from: this.opts.from,
			to: message.to,
			subject: message.subject,
			text: message.text,
			html: message.html,
		});
	}

	async healthCheck() {
		try {
			await this.transport.verify();
			return { ok: true };
		} catch (err) {
			return { ok: false, detail: String(err) };
		}
	}
}
