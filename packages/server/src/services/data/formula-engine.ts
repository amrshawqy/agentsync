import type { SchemaField } from '@agentsync/types';

/**
 * FormulaEngine — evaluates formula expressions on record data.
 * Computed on read (not stored). Uses recursive descent parser — no eval().
 *
 * Syntax:
 *   {field_slug}     — field reference
 *   + - * / %        — arithmetic operators
 *   ( )              — grouping
 *   IF(cond, then, else)
 *   CONCAT(a, b, ...)
 *   LEN(s), UPPER(s), LOWER(s)
 *   ROUND(n, digits)
 *   NOW()
 */
export class FormulaEngine {
	/**
	 * Evaluate a single formula string against a data context.
	 */
	evaluate(
		formula: string,
		context: { data: Record<string, unknown>; fields: SchemaField[] },
	): unknown {
		const resolved = this.resolveFieldRefs(formula, context.data);
		try {
			return this.parse(resolved);
		} catch {
			return null;
		}
	}

	/**
	 * Resolve all formula fields in a record's data, returning computed values.
	 */
	resolveFormulas(data: Record<string, unknown>, fields: SchemaField[]): Record<string, unknown> {
		const result: Record<string, unknown> = {};
		const formulaFields = fields.filter((f) => f.fieldType === 'formula');

		for (const field of formulaFields) {
			const formula = this.getFormulaExpression(field);
			if (!formula) continue;
			result[field.slug] = this.evaluate(formula, { data, fields });
		}

		return result;
	}

	private getFormulaExpression(field: SchemaField): string | null {
		const validation = field.validation as Record<string, unknown> | null;
		if (validation?.formula) return String(validation.formula);
		if (field.defaultValue && typeof field.defaultValue === 'string') return field.defaultValue;
		return null;
	}

	private resolveFieldRefs(formula: string, data: Record<string, unknown>): string {
		return formula.replace(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g, (_, slug: string) => {
			const value = data[slug];
			if (value === undefined || value === null) return '0';
			if (typeof value === 'number') return String(value);
			if (typeof value === 'string') return `"${value}"`;
			return String(value);
		});
	}

	// ── Recursive Descent Parser ──

	private pos = 0;
	private input = '';

	private parse(expr: string): unknown {
		this.pos = 0;
		this.input = expr.trim();
		const result = this.parseExpression();
		return result;
	}

	private peek(): string {
		this.skipWhitespace();
		return this.input[this.pos] ?? '';
	}

	private consume(expected?: string): string {
		this.skipWhitespace();
		const ch = this.input[this.pos];
		if (expected && ch !== expected) {
			throw new Error(`Expected '${expected}' at position ${this.pos}`);
		}
		this.pos++;
		return ch;
	}

	private skipWhitespace(): void {
		while (this.pos < this.input.length && /\s/.test(this.input[this.pos])) {
			this.pos++;
		}
	}

	private parseExpression(): unknown {
		return this.parseComparison();
	}

	private parseComparison(): unknown {
		let left = this.parseAddSub();

		while (this.pos < this.input.length) {
			this.skipWhitespace();
			const next2 = this.input.slice(this.pos, this.pos + 2);
			if (next2 === '>=' || next2 === '<=' || next2 === '!=' || next2 === '==') {
				this.pos += 2;
				const right = this.parseAddSub();
				switch (next2) {
					case '>=':
						left = Number(left) >= Number(right);
						break;
					case '<=':
						left = Number(left) <= Number(right);
						break;
					case '!=':
						left = left !== right;
						break;
					case '==':
						left = left === right;
						break;
				}
			} else if (this.peek() === '>' || this.peek() === '<') {
				const op = this.consume();
				const right = this.parseAddSub();
				left = op === '>' ? Number(left) > Number(right) : Number(left) < Number(right);
			} else {
				break;
			}
		}

		return left;
	}

	private parseAddSub(): unknown {
		let left = this.parseMulDiv();

		while (this.pos < this.input.length) {
			const op = this.peek();
			if (op === '+' || op === '-') {
				this.consume();
				const right = this.parseMulDiv();
				if (typeof left === 'string' || typeof right === 'string') {
					left = String(left) + String(right);
				} else {
					left = op === '+' ? Number(left) + Number(right) : Number(left) - Number(right);
				}
			} else {
				break;
			}
		}

		return left;
	}

	private parseMulDiv(): unknown {
		let left = this.parseUnary();

		while (this.pos < this.input.length) {
			const op = this.peek();
			if (op === '*' || op === '/' || op === '%') {
				this.consume();
				const right = this.parseUnary();
				if (op === '*') left = Number(left) * Number(right);
				else if (op === '/') {
					const divisor = Number(right);
					left = divisor === 0 ? null : Number(left) / divisor;
				} else left = Number(left) % Number(right);
			} else {
				break;
			}
		}

		return left;
	}

	private parseUnary(): unknown {
		if (this.peek() === '-') {
			this.consume();
			return -Number(this.parsePrimary());
		}
		return this.parsePrimary();
	}

	private parsePrimary(): unknown {
		this.skipWhitespace();

		// Parenthesized expression
		if (this.peek() === '(') {
			this.consume('(');
			const result = this.parseExpression();
			this.consume(')');
			return result;
		}

		// String literal
		if (this.peek() === '"') {
			return this.parseString();
		}

		// Number literal
		if (/[0-9.]/.test(this.peek())) {
			return this.parseNumber();
		}

		// Boolean literals
		if (this.input.slice(this.pos, this.pos + 4) === 'true') {
			this.pos += 4;
			return true;
		}
		if (this.input.slice(this.pos, this.pos + 5) === 'false') {
			this.pos += 5;
			return false;
		}

		// Function or identifier
		if (/[a-zA-Z_]/.test(this.peek())) {
			return this.parseFunctionOrIdentifier();
		}

		return null;
	}

	private parseString(): string {
		this.consume('"');
		let str = '';
		while (this.pos < this.input.length && this.input[this.pos] !== '"') {
			if (this.input[this.pos] === '\\') {
				this.pos++;
			}
			str += this.input[this.pos];
			this.pos++;
		}
		this.consume('"');
		return str;
	}

	private parseNumber(): number {
		let numStr = '';
		while (this.pos < this.input.length && /[0-9.]/.test(this.input[this.pos])) {
			numStr += this.input[this.pos];
			this.pos++;
		}
		return Number.parseFloat(numStr);
	}

	private parseFunctionOrIdentifier(): unknown {
		let name = '';
		while (this.pos < this.input.length && /[a-zA-Z_0-9]/.test(this.input[this.pos])) {
			name += this.input[this.pos];
			this.pos++;
		}

		// Check if it's a function call
		if (this.peek() === '(') {
			return this.callFunction(name.toUpperCase());
		}

		// Otherwise it's a bare identifier (shouldn't happen after ref resolution)
		return name;
	}

	private callFunction(name: string): unknown {
		this.consume('(');
		const args: unknown[] = [];

		if (this.peek() !== ')') {
			args.push(this.parseExpression());
			while (this.peek() === ',') {
				this.consume(',');
				args.push(this.parseExpression());
			}
		}
		this.consume(')');

		switch (name) {
			case 'IF':
				return args[0] ? args[1] : args[2];
			case 'CONCAT':
				return args.map(String).join('');
			case 'LEN':
				return String(args[0] ?? '').length;
			case 'UPPER':
				return String(args[0] ?? '').toUpperCase();
			case 'LOWER':
				return String(args[0] ?? '').toLowerCase();
			case 'ROUND': {
				const num = Number(args[0]);
				const digits = Number(args[1] ?? 0);
				const factor = 10 ** digits;
				return Math.round(num * factor) / factor;
			}
			case 'NOW':
				return new Date().toISOString();
			case 'ABS':
				return Math.abs(Number(args[0]));
			case 'MIN':
				return Math.min(...args.map(Number));
			case 'MAX':
				return Math.max(...args.map(Number));
			default:
				return null;
		}
	}
}
