import { describe, expect, it } from 'vitest';
import {
	explainRolePermissions,
	renderExplanationLines,
} from '../../src/services/auth/permission-explainer.js';

describe('explainRolePermissions', () => {
	it('handles wildcard admin', () => {
		const lines = explainRolePermissions({
			'*': { tables: { '*': { actions: ['read', 'write', 'delete'] } } },
		});
		expect(lines).toHaveLength(1);
		expect(lines[0].scope).toBe('all data in any workspace');
		expect(lines[0].actions).toContain('view');
	});

	it('describes per-table actions and missing delete', () => {
		const lines = explainRolePermissions({
			sales: { tables: { contacts: { actions: ['read', 'write'] } } },
		});
		expect(lines).toHaveLength(1);
		expect(lines[0].scope).toBe('contacts in sales');
		expect(lines[0].denied).toContain('delete records');
	});

	it('renders to a sentence', () => {
		const text = renderExplanationLines([
			{ scope: 'contacts in sales', actions: ['view', 'create and edit'] },
		]);
		expect(text).toContain('contacts in sales');
		expect(text).toContain('View and create and edit');
	});

	it('handles empty input', () => {
		expect(renderExplanationLines([])).toBe('No permissions granted.');
		expect(explainRolePermissions(null)).toEqual([]);
		expect(explainRolePermissions(undefined)).toEqual([]);
		expect(explainRolePermissions('not-an-object')).toEqual([]);
	});
});
