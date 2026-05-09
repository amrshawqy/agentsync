import { logger } from '../../../infra/logger.js';
import type { EmailMessage, EmailProvider } from '../types.js';

export class ConsoleEmailProvider implements EmailProvider {
	readonly name = 'console';

	async send(message: EmailMessage): Promise<void> {
		logger.info('[email:console] outbound message', {
			to: message.to,
			subject: message.subject,
			text: message.text,
		});
	}

	async healthCheck() {
		return { ok: true, detail: 'console provider always available' };
	}
}
