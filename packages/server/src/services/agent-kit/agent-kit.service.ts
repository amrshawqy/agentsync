import { eq, and } from 'drizzle-orm';
import type { Database } from '@agentsync/db';
import { agentKitTemplates, users, roles, teams } from '@agentsync/db';
import type { AgentKitFormat } from '@agentsync/types';
import type { SchemaService } from '../schema/schema.service.js';
import type { InstructionService } from '../instruction/instruction.service.js';
import type { PermissionService } from '../auth/permission.service.js';
import { TemplateEngine } from './template-engine.js';
import { SkillGenerator } from './skill-generator.js';
import { FormatAdapter } from './format-adapter.js';
import { Packager } from './packager.js';
import { StalenessDetector } from './staleness.js';
import { getConfig } from '../../config.js';

export class AgentKitService {
	private templateEngine = new TemplateEngine();
	private skillGenerator = new SkillGenerator();
	private formatAdapter = new FormatAdapter();
	private packager: Packager;
	private stalenessDetector: StalenessDetector;

	constructor(
		private db: Database,
		private schemaService: SchemaService,
		private instructionService: InstructionService,
	) {
		this.packager = new Packager();
		this.stalenessDetector = new StalenessDetector(db);
	}

	async generate(teamId: string, userId: string, format: AgentKitFormat) {
		const config = getConfig();

		// Gather context
		const [user] = await this.db.select().from(users).where(eq(users.id, userId));
		if (!user) throw new Error('User not found');

		const [team] = await this.db.select().from(teams).where(eq(teams.id, teamId));
		if (!team) throw new Error('Team not found');

		const [role] = user.roleId
			? await this.db.select().from(roles).where(eq(roles.id, user.roleId))
			: [null];

		// Get schema overview
		const schemaOverview = await this.schemaService.getSchemaOverview(teamId);

		// Get instructions
		const instructions = await this.instructionService.assemble(
			teamId,
			user.roleId ?? '',
		);

		// Generate skills from schema — filter by role permissions
		const rolePermissions = (role?.permissions ?? {}) as Record<string, any>;
		const allTables = schemaOverview.flatMap((ws: any) =>
			ws.tables.map((t: any) => ({
				slug: t.slug,
				name: t.name,
				fields: t.fields,
				_workspace: ws.workspace.slug,
			})),
		);
		const accessibleTables = allTables.filter((t: any) => {
			// Admin wildcard
			if (rolePermissions['*']?.tables?.['*']?.actions?.includes('read')) return true;
			for (const [wsSlug, wsPerms] of Object.entries(rolePermissions) as [string, any][]) {
				if (wsSlug === '*') return true;
				if (wsSlug !== t._workspace) continue;
				const tp = wsPerms?.tables?.[t.slug] ?? wsPerms?.tables?.['*'];
				if (tp?.actions?.includes('read')) return true;
			}
			return false;
		});
		const tables = accessibleTables.map(({ _workspace, ...rest }: any) => rest);
		const skills = this.skillGenerator.generate(tables);

		// Build kit content
		const kitContent = {
			identity: `You are ${user.name ?? user.email}, ${role?.name ?? 'member'} at ${team.name}.`,
			instructions,
			behavioralRules: [
				'Always check permissions before modifying data.',
				'Include provenance (confidence level) when creating or updating records.',
				'Use agent_hints from the schema to understand field purposes.',
				'Log a reason for every data modification.',
				'Respect state machine transitions — never skip states.',
			].join('\n'),
			skills,
			connectionConfig: {
				serverUrl: config.PUBLIC_BASE_URL,
				authType: 'oauth2',
				clientId: config.OAUTH_CLIENT_ID,
				scopes: ['read', 'write'],
			},
		};

		// Format for target platform
		const files = this.formatAdapter.adapt(format, kitContent);

		// Record generation for staleness tracking
		await this.stalenessDetector.recordGeneration(teamId, userId, format, {
			schema: schemaOverview,
			permissions: role?.permissions,
			instructions,
		});

		return { files, format };
	}

	async generateZip(teamId: string, userId: string, format: AgentKitFormat): Promise<Buffer> {
		const { files } = await this.generate(teamId, userId, format);
		return this.packager.packageAsZip(files);
	}

	async isStale(teamId: string, userId: string, format: AgentKitFormat): Promise<boolean> {
		const [user] = await this.db.select().from(users).where(eq(users.id, userId));
		if (!user) return true;

		const [role] = user.roleId
			? await this.db.select().from(roles).where(eq(roles.id, user.roleId))
			: [null];

		const schemaOverview = await this.schemaService.getSchemaOverview(teamId);
		const instructions = await this.instructionService.assemble(teamId, user.roleId ?? '');

		return this.stalenessDetector.isStale(teamId, userId, format, {
			schema: schemaOverview,
			permissions: role?.permissions,
			instructions,
		});
	}
}
