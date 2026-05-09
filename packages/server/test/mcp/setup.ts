import type { RequestContext } from '@agentsync/types';
import { vi } from 'vitest';
import { z } from 'zod';

/**
 * Captures tool registrations from the MCP server so we can invoke handlers directly.
 */
export interface RegisteredTool {
	name: string;
	description: string;
	schema: Record<string, unknown>;
	handler: (
		args: Record<string, unknown>,
		extra?: Record<string, unknown>,
	) => Promise<{
		content: Array<{ type: string; text: string }>;
		isError?: boolean;
	}>;
}

export function createMockMcpServer() {
	const tools: Map<string, RegisteredTool> = new Map();

	return {
		tool: vi.fn((name: string, description: string, schema: any, handler: any) => {
			tools.set(name, { name, description, schema, handler });
		}),
		getTools: () => tools,
		getTool: (name: string) => tools.get(name),
		invokeTool: async (
			name: string,
			args: Record<string, unknown>,
			extra?: Record<string, unknown>,
		) => {
			const tool = tools.get(name);
			if (!tool) throw new Error(`Tool '${name}' not registered`);
			// Apply Zod schema parsing to resolve defaults, matching real MCP SDK behavior
			const parsed = z.object(tool.schema as any).parse(args);
			return tool.handler(parsed, extra);
		},
	};
}

export function createAuthContextGetter(overrides?: Partial<RequestContext>): () => RequestContext {
	return () => ({
		teamId: 'team-test-1',
		userId: 'user-test-1',
		roleId: 'role-test-1',
		accountId: 'acct-test-1',
		agentId: 'agent-test-1',
		permissions: {},
		...overrides,
	});
}

export function createMockServiceContainer() {
	return {
		data: {
			createRecord: vi.fn().mockResolvedValue({ id: 'rec-1', data: {}, provenance: {} }),
			getRecord: vi
				.fn()
				.mockResolvedValue({ id: 'rec-1', data: {}, provenance: {}, relations: [] }),
			updateRecord: vi.fn().mockResolvedValue({ id: 'rec-1', data: {}, provenance: {} }),
			deleteRecord: vi.fn().mockResolvedValue({ id: 'rec-1' }),
			queryRecords: vi
				.fn()
				.mockResolvedValue({ data: [], total: 0, limit: 20, offset: 0, hasMore: false }),
			verifyField: vi.fn().mockResolvedValue({
				id: 'rec-1',
				provenance: { email: { agent: 'test', at: new Date().toISOString(), confidence: 1 } },
			}),
			bulkImport: vi.fn().mockResolvedValue([{ id: 'rec-1' }, { id: 'rec-2' }]),
		},
		schema: {
			getWorkspaceBySlug: vi.fn().mockResolvedValue({ id: 'ws-1', slug: 'crm', name: 'CRM' }),
			getTableBySlug: vi
				.fn()
				.mockResolvedValue({ id: 'tbl-1', slug: 'contacts', name: 'Contacts' }),
			findTableBySlug: vi
				.fn()
				.mockResolvedValue({ id: 'tbl-1', slug: 'contacts', name: 'Contacts' }),
			getFieldsForTable: vi.fn().mockResolvedValue([]),
			getSchemaOverview: vi.fn().mockResolvedValue([
				{
					workspace: { slug: 'crm', name: 'CRM' },
					tables: [{ slug: 'contacts', name: 'Contacts' }],
				},
			]),
			listWorkspaces: vi.fn().mockResolvedValue([{ id: 'ws-1', slug: 'crm', name: 'CRM' }]),
			createWorkspace: vi
				.fn()
				.mockResolvedValue({ id: 'ws-new', slug: 'new-ws', name: 'New Workspace' }),
			createTable: vi
				.fn()
				.mockResolvedValue({ id: 'tbl-new', slug: 'new-table', name: 'New Table' }),
			createField: vi.fn().mockResolvedValue({ id: 'fld-new', slug: 'new-field' }),
			alterTable: vi.fn().mockResolvedValue({ id: 'tbl-1', slug: 'contacts' }),
		},
		relation: {
			link: vi.fn().mockResolvedValue({
				id: 'rel-1',
				sourceRecordId: 'rec-1',
				targetRecordId: 'rec-2',
				relationType: 'contact',
			}),
			unlink: vi.fn().mockResolvedValue(undefined),
			traverse: vi.fn().mockResolvedValue([{ id: 'rec-2', data: {} }]),
			getRelationsForRecord: vi.fn().mockResolvedValue([]),
		},
		event: {
			subscribe: vi.fn().mockResolvedValue({
				id: 'sub-1',
				eventType: 'record.created',
				callbackType: 'sse',
				isActive: true,
			}),
			unsubscribe: vi.fn().mockResolvedValue(true),
			listSubscriptions: vi.fn().mockResolvedValue([]),
			emit: vi.fn().mockResolvedValue(undefined),
		},
		suggestion: {
			suggest: vi.fn().mockResolvedValue({ id: 'sug-1' }),
			listPending: vi.fn().mockResolvedValue([]),
			listPendingByUser: vi.fn().mockResolvedValue([]),
			listByUser: vi.fn().mockResolvedValue([]),
			approve: vi.fn().mockResolvedValue({ id: 'fld-1', slug: 'new_field' }),
			reject: vi.fn().mockResolvedValue(undefined),
		},
		blueprint: {
			deploy: vi.fn().mockResolvedValue({ id: 'ws-1', slug: 'crm', name: 'CRM' }),
			create: vi.fn().mockResolvedValue({ id: 'bp-1', slug: 'custom', version: 1 }),
			evolve: vi.fn().mockResolvedValue({ id: 'bp-1', slug: 'custom', version: 2 }),
			publish: vi.fn().mockResolvedValue({ id: 'bp-1', slug: 'custom', isPublished: true }),
			listBuiltin: vi
				.fn()
				.mockResolvedValue([
					{ id: 'bp-crm', slug: 'crm', name: 'CRM', category: 'sales', version: 1 },
				]),
			listPublished: vi.fn().mockResolvedValue([]),
			getById: vi.fn().mockResolvedValue({ id: 'bp-1', slug: 'crm' }),
		},
		audit: {
			log: vi.fn().mockResolvedValue(undefined),
			query: vi
				.fn()
				.mockResolvedValue({ data: [], total: 0, limit: 20, offset: 0, hasMore: false }),
		},
		user: {
			listByTeam: vi
				.fn()
				.mockResolvedValue([{ id: 'user-1', email: 'admin@test.com', name: 'Admin' }]),
			create: vi.fn().mockResolvedValue({ id: 'user-new', email: 'new@test.com' }),
			update: vi.fn().mockResolvedValue({ id: 'user-1', roleId: 'role-2' }),
			getByAccountAndTeam: vi.fn().mockResolvedValue(null),
		},
		team: {
			createRole: vi.fn().mockResolvedValue({ id: 'role-new', name: 'custom' }),
			updateRoleFieldAccess: vi.fn().mockResolvedValue({ id: 'role-1' }),
			create: vi.fn().mockResolvedValue({ id: 'team-new', name: 'New Team', slug: 'new-team' }),
			getBySlug: vi.fn().mockResolvedValue(null),
			getRoleByName: vi.fn().mockResolvedValue({ id: 'role-admin', name: 'admin' }),
		},
		account: {
			getById: vi.fn().mockResolvedValue({
				id: 'acct-1',
				limitsTier: 'verified',
				primaryEmail: 'admin@test.com',
			}),
			ensureAccountForMembership: vi.fn().mockResolvedValue('acct-1'),
			listMemberships: vi.fn().mockResolvedValue([]),
			countMemberships: vi.fn().mockResolvedValue(0),
		},
		agentIdentity: {
			createChallenge: vi.fn().mockResolvedValue({
				challengeId: '00000000-0000-0000-0000-000000000101',
				challenge: 'challenge-abc',
				expiresAt: new Date().toISOString(),
			}),
			registerFromChallenge: vi.fn().mockResolvedValue({
				accountId: 'acct-1',
				agentId: 'agent-1',
				thumbprint: 'thumbprint-1',
			}),
			issueOnboardingTokens: vi.fn().mockResolvedValue({
				accessToken: 'onboarding-token',
				refreshToken: 'refresh-token',
				expiresIn: 3600,
			}),
			issueTeamToken: vi.fn().mockResolvedValue({
				accessToken: 'team-token',
				expiresIn: 900,
			}),
			getProfile: vi.fn().mockResolvedValue({
				account: { id: 'acct-1' },
				memberships: [],
				agents: [],
			}),
		},
		emailVerification: {
			start: vi.fn().mockResolvedValue({
				challengeId: '00000000-0000-0000-0000-000000000102',
				maskedEmail: 'a***@test.com',
				expiresAt: new Date().toISOString(),
			}),
			verify: vi.fn().mockResolvedValue({
				limitsTier: 'verified',
			}),
		},
		invite: {
			createInvite: vi.fn().mockResolvedValue({
				invite: { id: 'invite-1', status: 'pending' },
				inviteCode: 'invite-code',
				inviteLink: 'http://localhost/invite/invite-code',
			}),
			acceptInvite: vi.fn().mockResolvedValue({
				inviteId: 'invite-1',
				teamId: 'team-test-1',
				roleId: 'role-member',
				membership: { id: 'user-new' },
			}),
		},
		agentKit: {
			generate: vi.fn().mockResolvedValue({ format: 'claude-code', config: {} }),
		},
		instruction: {
			assemble: vi.fn().mockResolvedValue('You are an AI agent...'),
		},
		automation: {
			create: vi.fn().mockResolvedValue({ id: 'auto-1', name: 'Test Automation', isActive: true }),
			list: vi.fn().mockResolvedValue([]),
			toggle: vi.fn().mockResolvedValue({ id: 'auto-1', name: 'Test Automation', isActive: false }),
		},
		marketplace: {
			searchBlueprints: vi.fn().mockResolvedValue({ data: [], total: 0 }),
			submitReview: vi.fn().mockResolvedValue({ id: 'rev-1', rating: 5 }),
		},
		search: {
			fullTextSearch: vi.fn().mockResolvedValue([]),
		},
		permission: {
			evaluate: vi.fn().mockResolvedValue({
				allowed: true,
				layer: 2,
				reason: 'Admin wildcard',
			}),
		},
	};
}

/**
 * Helper to extract text content from an MCP tool result.
 */
export function getResultText(result: { content: Array<{ type: string; text: string }> }): string {
	return result.content.find((c) => c.type === 'text')?.text ?? '';
}

/**
 * Helper to parse JSON from an MCP tool result.
 */
export function getResultJson(result: { content: Array<{ type: string; text: string }> }): unknown {
	return JSON.parse(getResultText(result));
}
