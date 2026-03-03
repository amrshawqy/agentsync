import type { Database } from '@agentsync/db';
import { instructions, teams, workspaces, schemaTables, schemaFields, roles } from '@agentsync/db';
import { eq, and } from 'drizzle-orm';

export async function assembleTeamContext(db: Database, teamId: string): Promise<string> {
	const [team] = await db.select().from(teams).where(eq(teams.id, teamId));
	if (!team) return '';

	const teamInstructions = await db
		.select()
		.from(instructions)
		.where(
			and(
				eq(instructions.teamId, teamId),
				eq(instructions.scope, 'team'),
				eq(instructions.isActive, true),
			),
		)
		.orderBy(instructions.priority);

	const parts = [`TEAM: ${team.name}`];
	for (const inst of teamInstructions) {
		if (inst.instructionType === 'context') {
			parts.push(inst.content);
		}
	}

	return parts.join('\n');
}

export async function assembleWorkspaceContext(
	db: Database,
	teamId: string,
	workspaceId: string,
): Promise<string> {
	const [ws] = await db
		.select()
		.from(workspaces)
		.where(and(eq(workspaces.id, workspaceId), eq(workspaces.teamId, teamId)));

	if (!ws) return '';

	const tables = await db
		.select()
		.from(schemaTables)
		.where(and(eq(schemaTables.workspaceId, workspaceId), eq(schemaTables.teamId, teamId)));

	const parts = [`WORKSPACE: ${ws.name} (${ws.slug})`];
	if (ws.description) parts.push(ws.description);
	parts.push('');
	parts.push('SCHEMA:');

	for (const table of tables) {
		const fields = await db
			.select()
			.from(schemaFields)
			.where(eq(schemaFields.tableId, table.id))
			.orderBy(schemaFields.fieldOrder);

		const fieldList = fields
			.map((f) => {
				let desc = `${f.name} (${f.fieldType})`;
				if (f.isRequired) desc += ' [required]';
				if (f.agentHint) desc += ` — ${f.agentHint}`;
				return desc;
			})
			.join(', ');

		parts.push(`- Table: ${table.name} (${fieldList})`);
		if (table.agentHint) parts.push(`  Hint: ${table.agentHint}`);
	}

	// Workspace-scoped instructions
	const wsInstructions = await db
		.select()
		.from(instructions)
		.where(
			and(
				eq(instructions.teamId, teamId),
				eq(instructions.scope, 'workspace'),
				eq(instructions.scopeId, workspaceId),
				eq(instructions.isActive, true),
			),
		)
		.orderBy(instructions.priority);

	if (wsInstructions.length > 0) {
		parts.push('');
		for (const inst of wsInstructions) {
			parts.push(inst.content);
		}
	}

	return parts.join('\n');
}

export async function assembleBusinessRules(
	db: Database,
	teamId: string,
): Promise<string> {
	const ruleInstructions = await db
		.select()
		.from(instructions)
		.where(
			and(
				eq(instructions.teamId, teamId),
				eq(instructions.instructionType, 'rules'),
				eq(instructions.isActive, true),
			),
		)
		.orderBy(instructions.priority);

	if (ruleInstructions.length === 0) return '';

	const parts = ['BUSINESS RULES:'];
	for (let i = 0; i < ruleInstructions.length; i++) {
		parts.push(`${i + 1}. ${ruleInstructions[i].content}`);
	}

	return parts.join('\n');
}

export async function assembleRoleGuidance(
	db: Database,
	teamId: string,
	roleId: string,
): Promise<string> {
	const [role] = await db.select().from(roles).where(eq(roles.id, roleId));
	if (!role) return '';

	const roleInstructions = await db
		.select()
		.from(instructions)
		.where(
			and(
				eq(instructions.teamId, teamId),
				eq(instructions.scope, 'role'),
				eq(instructions.scopeId, roleId),
				eq(instructions.isActive, true),
			),
		)
		.orderBy(instructions.priority);

	const parts = [`YOUR ROLE: ${role.name}`];
	for (const inst of roleInstructions) {
		parts.push(`- ${inst.content}`);
	}

	return parts.join('\n');
}
