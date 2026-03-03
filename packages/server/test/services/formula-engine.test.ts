import { describe, it, expect } from 'vitest';
import { FormulaEngine } from '../../src/services/data/formula-engine.js';
import type { SchemaField } from '@agentsync/types';

function makeField(overrides: Partial<SchemaField> & { slug: string; fieldType: string }): SchemaField {
	return {
		id: 'field-1',
		teamId: 'team-1',
		tableId: 'table-1',
		name: overrides.slug,
		isRequired: false,
		isIndexed: false,
		defaultValue: null,
		validation: null,
		options: null,
		constraints: null,
		relationConfig: null,
		rollupConfig: null,
		agentHint: null,
		sourceLayer: 'workspace',
		fieldOrder: 0,
		createdAt: new Date(),
		...overrides,
	} as SchemaField;
}

describe('FormulaEngine', () => {
	const engine = new FormulaEngine();

	it('resolves field references in formulas', () => {
		const data = { price: 10, quantity: 5 };
		const result = engine.evaluate('{price} * {quantity}', { data, fields: [] });
		expect(result).toBe(50);
	});

	it('handles addition and subtraction', () => {
		const data = { a: 10, b: 3 };
		const result = engine.evaluate('{a} + {b} - 1', { data, fields: [] });
		expect(result).toBe(12);
	});

	it('handles division', () => {
		const data = { total: 100, count: 4 };
		const result = engine.evaluate('{total} / {count}', { data, fields: [] });
		expect(result).toBe(25);
	});

	it('returns null for division by zero', () => {
		const data = { a: 10, b: 0 };
		const result = engine.evaluate('{a} / {b}', { data, fields: [] });
		expect(result).toBe(null);
	});

	it('handles modulo operator', () => {
		const data = { a: 10 };
		const result = engine.evaluate('{a} % 3', { data, fields: [] });
		expect(result).toBe(1);
	});

	it('handles parenthesized expressions', () => {
		const data = { a: 2, b: 3, c: 4 };
		const result = engine.evaluate('({a} + {b}) * {c}', { data, fields: [] });
		expect(result).toBe(20);
	});

	it('evaluates IF function (true branch)', () => {
		const data = { score: 80 };
		const result = engine.evaluate('IF({score} >= 70, "pass", "fail")', { data, fields: [] });
		expect(result).toBe('pass');
	});

	it('evaluates IF function (false branch)', () => {
		const data = { score: 50 };
		const result = engine.evaluate('IF({score} >= 70, "pass", "fail")', { data, fields: [] });
		expect(result).toBe('fail');
	});

	it('evaluates CONCAT function', () => {
		const data = { first: 'John', last: 'Doe' };
		const result = engine.evaluate('CONCAT({first}, " ", {last})', { data, fields: [] });
		expect(result).toBe('John Doe');
	});

	it('evaluates LEN function', () => {
		const data = { name: 'hello' };
		const result = engine.evaluate('LEN({name})', { data, fields: [] });
		expect(result).toBe(5);
	});

	it('evaluates UPPER and LOWER functions', () => {
		const data = { text: 'Hello' };
		expect(engine.evaluate('UPPER({text})', { data, fields: [] })).toBe('HELLO');
		expect(engine.evaluate('LOWER({text})', { data, fields: [] })).toBe('hello');
	});

	it('evaluates ROUND function', () => {
		const data = { val: 3.14159 };
		const result = engine.evaluate('ROUND({val}, 2)', { data, fields: [] });
		expect(result).toBe(3.14);
	});

	it('evaluates NOW function returns ISO string', () => {
		const result = engine.evaluate('NOW()', { data: {}, fields: [] });
		expect(typeof result).toBe('string');
		expect(new Date(result as string).getTime()).not.toBeNaN();
	});

	it('handles null/undefined field references gracefully', () => {
		const data = { price: 10 };
		const result = engine.evaluate('{price} * {missing}', { data, fields: [] });
		expect(result).toBe(0); // missing resolves to 0
	});

	it('resolveFormulas processes formula fields', () => {
		const data = { price: 10, quantity: 5 };
		const fields = [
			makeField({ slug: 'price', fieldType: 'number' }),
			makeField({ slug: 'quantity', fieldType: 'number' }),
			makeField({
				slug: 'total',
				fieldType: 'formula',
				validation: { formula: '{price} * {quantity}' },
			}),
		];

		const result = engine.resolveFormulas(data, fields);
		expect(result.total).toBe(50);
	});

	it('resolveFormulas uses defaultValue as formula expression', () => {
		const data = { name: 'hello' };
		const fields = [
			makeField({ slug: 'name', fieldType: 'text' }),
			makeField({
				slug: 'name_upper',
				fieldType: 'formula',
				defaultValue: 'UPPER({name})',
			}),
		];

		const result = engine.resolveFormulas(data, fields);
		expect(result.name_upper).toBe('HELLO');
	});

	it('handles negative numbers', () => {
		const result = engine.evaluate('-5 + 3', { data: {}, fields: [] });
		expect(result).toBe(-2);
	});
});
