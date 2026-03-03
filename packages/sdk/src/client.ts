import type { ApiResponse, HealthResponse } from '@agentsync/types';
import { OAuthHelper, type OAuthConfig, type TokenSet } from './auth.js';
import { RecordResource } from './resources/records.js';
import { SchemaResource } from './resources/schema.js';
import { BlueprintResource } from './resources/blueprints.js';
import { MemberResource } from './resources/members.js';
import { EventResource } from './resources/events.js';
import { AuditResource } from './resources/audit.js';
import { SuggestionResource } from './resources/suggestions.js';
import { AutomationResource } from './resources/automations.js';
import { InstructionResource } from './resources/instructions.js';
import { MarketplaceResource } from './resources/marketplace.js';
import { WorkspaceResource } from './resources/workspaces.js';
import { UploadResource } from './resources/uploads.js';
import { SSEConsumer } from './events/index.js';

export interface AgentSyncClientConfig {
	serverUrl: string;
	accessToken?: string;
	oauth?: OAuthConfig;
}

export class AgentSyncClient {
	private serverUrl: string;
	private accessToken?: string;
	private oauth?: OAuthHelper;

	readonly records: RecordResource;
	readonly schema: SchemaResource;
	readonly blueprints: BlueprintResource;
	readonly members: MemberResource;
	readonly events: EventResource;
	readonly audit: AuditResource;
	readonly suggestions: SuggestionResource;
	readonly automations: AutomationResource;
	readonly instructions: InstructionResource;
	readonly marketplace: MarketplaceResource;
	readonly workspaces: WorkspaceResource;
	readonly uploads: UploadResource;

	constructor(config: AgentSyncClientConfig) {
		this.serverUrl = config.serverUrl.replace(/\/$/, '');
		this.accessToken = config.accessToken;

		if (config.oauth) {
			this.oauth = new OAuthHelper(config.oauth);
		}

		const requestFn = this.request.bind(this);
		this.records = new RecordResource(requestFn);
		this.schema = new SchemaResource(requestFn);
		this.blueprints = new BlueprintResource(requestFn);
		this.members = new MemberResource(requestFn);
		this.events = new EventResource(requestFn);
		this.audit = new AuditResource(requestFn);
		this.suggestions = new SuggestionResource(requestFn);
		this.automations = new AutomationResource(requestFn);
		this.instructions = new InstructionResource(requestFn);
		this.marketplace = new MarketplaceResource(requestFn);
		this.workspaces = new WorkspaceResource(requestFn);
		this.uploads = new UploadResource(requestFn);
	}

	private async getAuthHeader(): Promise<string> {
		if (this.accessToken) return `Bearer ${this.accessToken}`;
		if (this.oauth) {
			const token = await this.oauth.getAccessToken();
			return `Bearer ${token}`;
		}
		throw new Error('Not authenticated. Provide accessToken or configure OAuth.');
	}

	async request<T>(
		method: string,
		path: string,
		body?: unknown,
		opts?: { auth?: boolean; headers?: Record<string, string> },
	): Promise<T> {
		const url = `${this.serverUrl}${path}`;
		const headers: Record<string, string> = {
			...(opts?.headers ?? {}),
		};

		if (opts?.auth !== false) {
			headers.Authorization = await this.getAuthHeader();
		}
		if (body !== undefined && method !== 'GET') {
			headers['Content-Type'] = 'application/json';
		}

		const response = await fetch(url, {
			method,
			headers,
			body: body && method !== 'GET' ? JSON.stringify(body) : undefined,
		});

		if (!response.ok) {
			const error = await response.json().catch(() => ({ message: response.statusText }));
			throw new Error(`AgentSync API error (${response.status}): ${JSON.stringify(error)}`);
		}

		return response.json() as Promise<T>;
	}

	async health(): Promise<HealthResponse> {
		return this.request<HealthResponse>('GET', '/health', undefined, { auth: false });
	}

	async getInstructions(): Promise<ApiResponse<string>> {
		return this.request<ApiResponse<string>>('GET', '/v1/instructions/assembled');
	}

	async getAgentKit(format: string = 'claude-code'): Promise<ApiResponse<Record<string, unknown>>> {
		return this.request<ApiResponse<Record<string, unknown>>>('GET', `/v1/agent-kit?format=${format}`);
	}

	createEventStream(): SSEConsumer {
		return new SSEConsumer(
			`${this.serverUrl}/v1/events/stream`,
			async () => {
				const header = await this.getAuthHeader();
				return header.startsWith('Bearer ') ? header.slice(7) : header;
			},
		);
	}

	setAccessToken(token: string): void {
		this.accessToken = token;
	}

	setTokens(tokenSet: TokenSet): void {
		if (this.oauth) {
			this.oauth.setTokens(tokenSet);
		}
	}
}
