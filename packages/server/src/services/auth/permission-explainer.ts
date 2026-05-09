/**
 * Translate a role's permissions JSON into plain-English bullets for the
 * OAuth consent screen. Supports the shape used by the 6-layer permission
 * engine: `{ [workspace]: { tables: { [table]: { actions: [...], field_access?, record_filters? } } } }`.
 */

const ACTION_LABELS: Record<string, string> = {
	read: 'view',
	write: 'create and edit',
	create: 'create',
	update: 'edit',
	delete: 'delete',
};

export interface ExplanationLine {
	scope: string; // e.g. "all data" or "contacts in CRM"
	actions: string[]; // e.g. ["view", "create and edit"]
	denied?: string[]; // e.g. ["delete"] — explicitly missing important actions
}

export function explainRolePermissions(permissions: unknown): ExplanationLine[] {
	if (!permissions || typeof permissions !== 'object') return [];
	const lines: ExplanationLine[] = [];
	const root = permissions as Record<string, unknown>;

	for (const [workspace, workspaceVal] of Object.entries(root)) {
		if (!workspaceVal || typeof workspaceVal !== 'object') continue;

		// Wildcard admin
		if (workspace === '*') {
			const tables = (workspaceVal as { tables?: Record<string, unknown> }).tables ?? {};
			const wildcard = tables['*'];
			if (wildcard && typeof wildcard === 'object') {
				const actions = readActionList(wildcard);
				if (actions.length > 0) {
					lines.push({
						scope: 'all data in any workspace',
						actions: actions.map(formatAction),
					});
					continue;
				}
			}
		}

		const tables = (workspaceVal as { tables?: Record<string, unknown> }).tables ?? {};
		for (const [tableName, tablePerm] of Object.entries(tables)) {
			if (!tablePerm || typeof tablePerm !== 'object') continue;
			const actions = readActionList(tablePerm);
			if (actions.length === 0) continue;
			const scope =
				tableName === '*' ? `all tables in ${workspace}` : `${tableName} in ${workspace}`;
			const denied: string[] = [];
			if (!actions.includes('delete')) denied.push('delete records');
			lines.push({
				scope,
				actions: actions.map(formatAction),
				denied: denied.length > 0 ? denied : undefined,
			});
		}
	}

	return lines;
}

function readActionList(tablePerm: unknown): string[] {
	if (!tablePerm || typeof tablePerm !== 'object') return [];
	const actions = (tablePerm as { actions?: unknown }).actions;
	if (!Array.isArray(actions)) return [];
	return actions.filter((a): a is string => typeof a === 'string');
}

function formatAction(action: string): string {
	return ACTION_LABELS[action] ?? action;
}

export function renderExplanationLines(lines: ExplanationLine[]): string {
	if (lines.length === 0) return 'No permissions granted.';
	return lines
		.map((line) => {
			const verbs = line.actions.length > 0 ? line.actions.join(' and ') : 'access';
			let text = `${capitalize(verbs)} ${line.scope}`;
			if (line.denied && line.denied.length > 0) {
				text += ` (cannot ${line.denied.join(', ')})`;
			}
			return text;
		})
		.join('; ');
}

function capitalize(s: string): string {
	return s.charAt(0).toUpperCase() + s.slice(1);
}
