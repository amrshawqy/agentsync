import type { Database } from '@agentsync/db';
import type Redis from 'ioredis';

import { CacheService } from './cache/cache.service.js';
import { AuthService } from './auth/auth.service.js';
import { PermissionService } from './auth/permission.service.js';
import { AccountService } from './auth/account.service.js';
import { AgentIdentityService } from './auth/agent-identity.service.js';
import { EmailVerificationService } from './auth/email-verification.service.js';
import { SchemaService } from './schema/schema.service.js';
import { ConstraintService } from './schema/constraint.service.js';
import { ProvenanceService } from './data/provenance.service.js';
import { IndexService } from './data/index.service.js';
import { RelationService } from './data/relation.service.js';
import { SearchService } from './data/search.service.js';
import { DataService } from './data/data.service.js';
import { EventDispatcher } from './event/dispatcher.js';
import { SSEManager } from './event/sse-manager.js';
import { WebhookSender } from './event/webhook-sender.js';
import { EventService } from './event/event.service.js';
import { InstructionService } from './instruction/instruction.service.js';
import { AgentKitService } from './agent-kit/agent-kit.service.js';
import { BlueprintService } from './blueprint/blueprint.service.js';
import { MarketplaceService } from './blueprint/marketplace.service.js';
import { TeamService } from './team/team.service.js';
import { InviteService } from './team/invite.service.js';
import { UserService } from './user/user.service.js';
import { SuggestionService } from './suggestion/suggestion.service.js';
import { AuditService } from './audit/audit.service.js';
import { AutomationService } from './automation/automation.service.js';
import { AutomationEngine } from './automation/automation-engine.js';
import { FormulaEngine } from './data/formula-engine.js';
import { RollupEngine } from './data/rollup-engine.js';
import { StorageService } from './storage/storage.service.js';

export interface ServiceContainer {
	cache: CacheService;
	auth: AuthService;
	account: AccountService;
	agentIdentity: AgentIdentityService;
	emailVerification: EmailVerificationService;
	permission: PermissionService;
	schema: SchemaService;
	constraint: ConstraintService;
	data: DataService;
	provenance: ProvenanceService;
	relation: RelationService;
	event: EventService;
	sseManager: SSEManager;
	instruction: InstructionService;
	agentKit: AgentKitService;
	blueprint: BlueprintService;
	marketplace: MarketplaceService;
	team: TeamService;
	invite: InviteService;
	user: UserService;
	suggestion: SuggestionService;
	audit: AuditService;
	automation: AutomationService;
	automationEngine: AutomationEngine;
	search: SearchService;
	storage?: StorageService;
}

export function createServices(db: Database, redis: Redis): ServiceContainer {
	// Infrastructure
	const cache = new CacheService(redis);

	// Auth
	const auth = new AuthService(db, cache);
	const account = new AccountService(db);
	const agentIdentity = new AgentIdentityService(db);
	const emailVerification = new EmailVerificationService(db);
	const permission = new PermissionService(db, cache);

	// Schema
	const schema = new SchemaService(db, cache);
	const constraint = new ConstraintService(schema);

	// Data
	const provenance = new ProvenanceService();
	const indexService = new IndexService(db);
	const relation = new RelationService(db);
	const search = new SearchService(db);
	// Events (must create before DataService to inject)
	const dispatcher = new EventDispatcher(redis);
	const sseManager = new SSEManager();
	const webhookSender = new WebhookSender();
	const event = new EventService(db, dispatcher, sseManager, webhookSender);

	// Audit (must create before DataService to inject)
	const audit = new AuditService(db);

	const formulaEngine = new FormulaEngine();
	const rollupEngine = new RollupEngine(db, relation);

	const data = new DataService(
		db,
		provenance,
		indexService,
		relation,
		search,
		constraint,
		permission,
		schema,
		event,
		audit,
		formulaEngine,
		rollupEngine,
	);

	// Instructions
	const instruction = new InstructionService(db, cache);

	// Agent Kit
	const agentKit = new AgentKitService(db, schema, instruction);

	// Blueprint (with constraint + provenance injected)
	const blueprint = new BlueprintService(db, schema, constraint, provenance);

	// Marketplace
	const marketplace = new MarketplaceService(db);

	// Core entities
	const team = new TeamService(db);
	const invite = new InviteService(db);
	const user = new UserService(db);
	const suggestion = new SuggestionService(db, schema);
	const automation = new AutomationService(db);

	// Automation Engine
	const automationEngine = new AutomationEngine(dispatcher, automation, data, event);

	// Storage (optional — only if S3 config is present)
	let storage: StorageService | undefined;
	const s3Bucket = process.env.S3_BUCKET;
	const s3AccessKey = process.env.S3_ACCESS_KEY_ID;
	const s3SecretKey = process.env.S3_SECRET_ACCESS_KEY;
	if (s3Bucket && s3AccessKey && s3SecretKey) {
		storage = new StorageService({
			bucket: s3Bucket,
			region: process.env.S3_REGION ?? 'us-east-1',
			endpoint: process.env.S3_ENDPOINT,
			accessKeyId: s3AccessKey,
			secretAccessKey: s3SecretKey,
		});
	}

	return {
		cache,
		auth,
		account,
		agentIdentity,
		emailVerification,
		permission,
		schema,
		constraint,
		data,
		provenance,
		relation,
		event,
		sseManager,
		instruction,
		agentKit,
		blueprint,
		marketplace,
		team,
		invite,
		user,
		suggestion,
		audit,
		automation,
		automationEngine,
		search,
		storage,
	};
}

export {
	CacheService,
	AuthService,
	AccountService,
	AgentIdentityService,
	EmailVerificationService,
	PermissionService,
	SchemaService,
	ConstraintService,
	ProvenanceService,
	IndexService,
	RelationService,
	SearchService,
	DataService,
	EventDispatcher,
	SSEManager,
	WebhookSender,
	EventService,
	InstructionService,
	AgentKitService,
	BlueprintService,
	MarketplaceService,
	TeamService,
	InviteService,
	UserService,
	SuggestionService,
	AuditService,
	AutomationService,
	AutomationEngine,
	FormulaEngine,
	RollupEngine,
	StorageService,
};
