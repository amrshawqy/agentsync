import { describe, it, expect } from 'vitest';
import { resolveSchemaLayers } from '../../src/services/schema/layer-resolver.js';
import type { SchemaTable, SchemaField } from '@agentsync/types';

function makeTable(slug: string, overrides: Partial<SchemaTable> = {}): SchemaTable {
	return {
		id: `table-${slug}`,
		teamId: 'team-1',
		workspaceId: 'ws-1',
		name: slug.charAt(0).toUpperCase() + slug.slice(1),
		slug,
		description: null,
		agentHint: null,
		sourceLayer: 'core',
		blueprintId: null,
		settings: {},
		createdAt: new Date(),
		updatedAt: new Date(),
		...overrides,
	} as SchemaTable;
}

function makeField(
	slug: string,
	tableId: string,
	fieldOrder: number,
	overrides: Partial<SchemaField> = {},
): SchemaField {
	return {
		id: `field-${slug}`,
		teamId: 'team-1',
		tableId,
		name: slug.charAt(0).toUpperCase() + slug.slice(1),
		slug,
		fieldType: 'text',
		isRequired: false,
		isIndexed: false,
		defaultValue: null,
		validation: null,
		options: null,
		constraints: null,
		relationConfig: null,
		agentHint: null,
		sourceLayer: 'core',
		fieldOrder,
		createdAt: new Date(),
		...overrides,
	} as SchemaField;
}

describe('resolveSchemaLayers', () => {
	it('returns core tables when no blueprint or workspace layers', () => {
		const core = [
			{ table: makeTable('contacts'), fields: [makeField('name', 'table-contacts', 0)] },
		];

		const result = resolveSchemaLayers(core, [], []);

		expect(result).toHaveLength(1);
		expect(result[0].table.slug).toBe('contacts');
		expect(result[0].fields).toHaveLength(1);
	});

	it('blueprint adds a new table to core tables', () => {
		const core = [
			{ table: makeTable('contacts'), fields: [makeField('name', 'table-contacts', 0)] },
		];
		const blueprint = [
			{ table: makeTable('deals', { sourceLayer: 'blueprint' }), fields: [makeField('amount', 'table-deals', 0)] },
		];

		const result = resolveSchemaLayers(core, blueprint, []);

		expect(result).toHaveLength(2);
		const slugs = result.map((r) => r.table.slug);
		expect(slugs).toContain('contacts');
		expect(slugs).toContain('deals');
	});

	it('blueprint field overrides core field with same slug', () => {
		const core = [
			{
				table: makeTable('contacts'),
				fields: [makeField('name', 'table-contacts', 0, { agentHint: 'core hint' })],
			},
		];
		const blueprint = [
			{
				table: makeTable('contacts', { sourceLayer: 'blueprint' }),
				fields: [makeField('name', 'table-contacts', 0, { agentHint: 'blueprint hint', sourceLayer: 'blueprint' })],
			},
		];

		const result = resolveSchemaLayers(core, blueprint, []);

		expect(result).toHaveLength(1);
		expect(result[0].fields[0].agentHint).toBe('blueprint hint');
	});

	it('workspace field overrides blueprint field with same slug', () => {
		const blueprint = [
			{
				table: makeTable('contacts', { sourceLayer: 'blueprint' }),
				fields: [makeField('name', 'table-contacts', 0, { agentHint: 'blueprint hint' })],
			},
		];
		const workspace = [
			{
				table: makeTable('contacts', { sourceLayer: 'workspace' }),
				fields: [makeField('name', 'table-contacts', 0, { agentHint: 'workspace hint', sourceLayer: 'workspace' })],
			},
		];

		const result = resolveSchemaLayers([], blueprint, workspace);

		expect(result).toHaveLength(1);
		expect(result[0].fields[0].agentHint).toBe('workspace hint');
	});

	it('all 3 layers with the same table: workspace wins', () => {
		const core = [
			{
				table: makeTable('contacts'),
				fields: [makeField('name', 'table-contacts', 0, { agentHint: 'core' })],
			},
		];
		const blueprint = [
			{
				table: makeTable('contacts', { sourceLayer: 'blueprint' }),
				fields: [makeField('name', 'table-contacts', 0, { agentHint: 'blueprint' })],
			},
		];
		const workspace = [
			{
				table: makeTable('contacts', { sourceLayer: 'workspace' }),
				fields: [makeField('name', 'table-contacts', 0, { agentHint: 'workspace' })],
			},
		];

		const result = resolveSchemaLayers(core, blueprint, workspace);

		expect(result).toHaveLength(1);
		expect(result[0].fields[0].agentHint).toBe('workspace');
	});

	it('fields are sorted by fieldOrder after merge', () => {
		const core = [
			{
				table: makeTable('contacts'),
				fields: [
					makeField('name', 'table-contacts', 2),
					makeField('email', 'table-contacts', 0),
				],
			},
		];
		const blueprint = [
			{
				table: makeTable('contacts', { sourceLayer: 'blueprint' }),
				fields: [
					makeField('phone', 'table-contacts', 1),
				],
			},
		];

		const result = resolveSchemaLayers(core, blueprint, []);

		expect(result).toHaveLength(1);
		expect(result[0].fields).toHaveLength(3);
		expect(result[0].fields[0].slug).toBe('email');
		expect(result[0].fields[1].slug).toBe('phone');
		expect(result[0].fields[2].slug).toBe('name');
	});
});
