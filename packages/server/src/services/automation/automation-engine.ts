import type { EventPayload } from '@agentsync/types';
import { getWebhookUrlConfig } from '../../config.js';
import { logger } from '../../infra/logger.js';
import { validateWebhookUrl } from '../../infra/url-validator.js';
import type { DataService } from '../data/data.service.js';
import type { EventDispatcher } from '../event/dispatcher.js';
import type { EventService } from '../event/event.service.js';
import type { AutomationService } from './automation.service.js';

const CONSUMER_GROUP = 'automation-engine';
const CONSUMER_NAME = 'worker-1';
const POLL_INTERVAL = 2000;

interface AutomationTrigger {
	eventType?: string;
	table?: string;
	condition?: Record<string, unknown>;
}

interface AutomationAction {
	type: string;
	url?: string;
	method?: string;
	headers?: Record<string, string>;
	body?: Record<string, unknown>;
	tableId?: string;
	data?: Record<string, unknown>;
	recordId?: string;
	title?: string;
	message?: string;
	recipients?: string[];
}

export class AutomationEngine {
	private running = false;
	private pollTimer: ReturnType<typeof setTimeout> | null = null;

	constructor(
		private dispatcher: EventDispatcher,
		private automationService: AutomationService,
		private dataService: DataService,
		private eventService: EventService,
	) {}

	async start(): Promise<void> {
		if (this.running) return;
		this.running = true;
		logger.info('AutomationEngine started');
		this.poll();
	}

	async stop(): Promise<void> {
		this.running = false;
		if (this.pollTimer) {
			clearTimeout(this.pollTimer);
			this.pollTimer = null;
		}
		logger.info('AutomationEngine stopped');
	}

	private async poll(): Promise<void> {
		if (!this.running) return;

		try {
			const entries = await this.dispatcher.readNewEvents(CONSUMER_GROUP, CONSUMER_NAME, 10);
			for (const entry of entries) {
				try {
					await this.processEvent(entry.event);
					await this.dispatcher.acknowledge(CONSUMER_GROUP, entry.id);
				} catch (err) {
					logger.error('AutomationEngine: failed to process event', {
						eventId: entry.event.eventId,
						error: String(err),
					});
				}
			}
		} catch (err) {
			logger.error('AutomationEngine: poll error', { error: String(err) });
		}

		// Schedule next poll
		this.pollTimer = setTimeout(() => this.poll(), POLL_INTERVAL);
	}

	async processEvent(event: EventPayload): Promise<void> {
		// Fetch all active automations for this team
		const automations = await this.automationService.list(event.teamId);
		const active = automations.filter((a) => a.isActive);

		for (const automation of active) {
			const trigger = automation.trigger as AutomationTrigger;
			if (!this.matchesTrigger(trigger, event)) continue;

			const actions = automation.actions as AutomationAction[];
			await this.executeActions(actions, event);
		}
	}

	matchesTrigger(trigger: AutomationTrigger, event: EventPayload): boolean {
		if (trigger.eventType && trigger.eventType !== event.eventType) return false;
		if (trigger.table && trigger.table !== event.table) return false;

		if (trigger.condition && event.data) {
			for (const [key, value] of Object.entries(trigger.condition)) {
				if (event.data[key] !== value) return false;
			}
		}

		return true;
	}

	private buildSystemContext(teamId: string) {
		return {
			teamId,
			userId: 'system',
			roleId: 'system',
			agentId: 'automation-engine',
			permissions: {},
		};
	}

	private interpolateEventData(
		data: Record<string, unknown>,
		event: EventPayload,
	): Record<string, unknown> {
		const result: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(data)) {
			if (typeof value === 'string' && value.includes('{{')) {
				result[key] = value.replace(/\{\{(.+?)\}\}/g, (_, path: string) => {
					const resolved = this.resolveEventPath(event, path.trim());
					return resolved !== undefined ? String(resolved) : '';
				});
			} else {
				result[key] = value;
			}
		}
		return result;
	}

	private resolveEventPath(event: EventPayload, dotPath: string): unknown {
		const parts = dotPath.split('.');
		let current: unknown = event;
		for (const part of parts) {
			if (current == null || typeof current !== 'object') return undefined;
			current = (current as Record<string, unknown>)[part];
		}
		return current;
	}

	private async executeActions(actions: AutomationAction[], event: EventPayload): Promise<void> {
		for (const action of actions) {
			try {
				switch (action.type) {
					case 'webhook': {
						if (!action.url) break;
						await validateWebhookUrl(action.url, getWebhookUrlConfig());
						await fetch(action.url, {
							method: action.method ?? 'POST',
							headers: {
								'Content-Type': 'application/json',
								'X-AgentSync-Automation': 'true',
								...action.headers,
							},
							body: JSON.stringify({
								event,
								actionConfig: action.body,
							}),
							signal: AbortSignal.timeout(10000),
						});
						break;
					}
					case 'create_record': {
						if (!action.tableId) break;
						const createCtx = this.buildSystemContext(event.teamId);
						const createData = action.data ? this.interpolateEventData(action.data, event) : {};
						await this.dataService.createRecord(createCtx, {
							tableId: action.tableId,
							data: createData,
						});
						break;
					}
					case 'update_record': {
						const targetId = action.recordId ?? event.recordId;
						if (!targetId) break;
						const updateCtx = this.buildSystemContext(event.teamId);
						const updateData = action.data ? this.interpolateEventData(action.data, event) : {};
						await this.dataService.updateRecord(updateCtx, targetId, { data: updateData });
						break;
					}
					case 'send_notification': {
						await this.eventService.emit({
							eventType: 'record.updated',
							teamId: event.teamId,
							data: {
								notification: true,
								title: action.title ?? 'Automation Notification',
								message: action.message ?? '',
								recipients: action.recipients ?? [],
							},
						});
						break;
					}
					default:
						logger.warn('AutomationEngine: unknown action type', { type: action.type });
				}
			} catch (err) {
				logger.error('AutomationEngine: action execution failed', {
					actionType: action.type,
					error: String(err),
				});
			}
		}
	}
}
