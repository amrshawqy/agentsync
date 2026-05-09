import type { EventPayload } from '@agentsync/types';
import { getWebhookUrlConfig } from '../../config.js';
import { logger } from '../../infra/logger.js';
import { validateWebhookUrl } from '../../infra/url-validator.js';

const MAX_RETRIES = 3;
const BACKOFF_BASE = 1000;

export class WebhookSender {
	async send(url: string, event: EventPayload, retries = 0): Promise<boolean> {
		try {
			// Defense in depth: validate URL before every send attempt
			await validateWebhookUrl(url, getWebhookUrlConfig());

			const response = await fetch(url, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-AgentSync-Event': event.eventType,
					'X-AgentSync-Delivery': event.eventId,
				},
				body: JSON.stringify(event),
				signal: AbortSignal.timeout(10000),
			});

			if (response.ok) {
				logger.debug('Webhook delivered', { url, eventId: event.eventId });
				return true;
			}

			if (response.status >= 500 && retries < MAX_RETRIES) {
				return this.retry(url, event, retries);
			}

			logger.warn('Webhook failed', {
				url,
				eventId: event.eventId,
				status: response.status,
			});
			return false;
		} catch (err) {
			if (retries < MAX_RETRIES) {
				return this.retry(url, event, retries);
			}

			logger.error('Webhook delivery failed after retries', {
				url,
				eventId: event.eventId,
				error: String(err),
			});
			return false;
		}
	}

	private async retry(url: string, event: EventPayload, retries: number): Promise<boolean> {
		const delay = BACKOFF_BASE * 2 ** retries;
		logger.debug('Webhook retry scheduled', {
			url,
			eventId: event.eventId,
			attempt: retries + 1,
			delay,
		});
		await new Promise((resolve) => setTimeout(resolve, delay));
		return this.send(url, event, retries + 1);
	}
}
