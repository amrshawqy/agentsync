import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConstraintService } from '../../src/services/schema/constraint.service.js';
import type { SchemaField } from '@agentsync/types';

function createMockSchemaService(fields: Partial<SchemaField>[]) {
	return {
		getFieldsForTable: vi.fn().mockResolvedValue(fields),
	} as any;
}

function makeField(overrides: Partial<SchemaField> & { slug: string; name: string; fieldType: string }): Partial<SchemaField> {
	return {
		isRequired: false,
		validation: null,
		options: null,
		constraints: null,
		...overrides,
	};
}

describe('ConstraintService', () => {
	it('returns REQUIRED_FIELD_MISSING when required field missing on create', async () => {
		const fields = [makeField({ slug: 'title', name: 'Title', fieldType: 'text', isRequired: true })];
		const schemaService = createMockSchemaService(fields);
		const service = new ConstraintService(schemaService);

		const violations = await service.validate('table-1', {});

		expect(violations).toHaveLength(1);
		expect(violations[0].code).toBe('REQUIRED_FIELD_MISSING');
		expect(violations[0].field).toBe('title');
	});

	it('returns REQUIRED_FIELD_MISSING when required field set to null on update', async () => {
		const fields = [makeField({ slug: 'title', name: 'Title', fieldType: 'text', isRequired: true })];
		const schemaService = createMockSchemaService(fields);
		const service = new ConstraintService(schemaService);

		const violations = await service.validate('table-1', { title: null }, { title: 'Old Value' });

		expect(violations).toHaveLength(1);
		expect(violations[0].code).toBe('REQUIRED_FIELD_MISSING');
	});

	it('returns INVALID_FIELD_TYPE for number field with string value', async () => {
		const fields = [makeField({ slug: 'amount', name: 'Amount', fieldType: 'number' })];
		const schemaService = createMockSchemaService(fields);
		const service = new ConstraintService(schemaService);

		const violations = await service.validate('table-1', { amount: 'not-a-number' });

		expect(violations).toHaveLength(1);
		expect(violations[0].code).toBe('INVALID_FIELD_TYPE');
		expect(violations[0].field).toBe('amount');
	});

	it('returns INVALID_FIELD_TYPE for email field without @', async () => {
		const fields = [makeField({ slug: 'email', name: 'Email', fieldType: 'email' })];
		const schemaService = createMockSchemaService(fields);
		const service = new ConstraintService(schemaService);

		const violations = await service.validate('table-1', { email: 'invalid-email' });

		expect(violations).toHaveLength(1);
		expect(violations[0].code).toBe('INVALID_FIELD_TYPE');
	});

	it('returns INVALID_FIELD_TYPE for URL field with invalid URL', async () => {
		const fields = [makeField({ slug: 'website', name: 'Website', fieldType: 'url' })];
		const schemaService = createMockSchemaService(fields);
		const service = new ConstraintService(schemaService);

		const violations = await service.validate('table-1', { website: 'not-a-url' });

		expect(violations).toHaveLength(1);
		expect(violations[0].code).toBe('INVALID_FIELD_TYPE');
	});

	it('returns INVALID_FIELD_TYPE for boolean field with string', async () => {
		const fields = [makeField({ slug: 'active', name: 'Active', fieldType: 'boolean' })];
		const schemaService = createMockSchemaService(fields);
		const service = new ConstraintService(schemaService);

		const violations = await service.validate('table-1', { active: 'true' });

		expect(violations).toHaveLength(1);
		expect(violations[0].code).toBe('INVALID_FIELD_TYPE');
	});

	it('returns INVALID_FIELD_TYPE for date field with invalid date', async () => {
		const fields = [makeField({ slug: 'due', name: 'Due Date', fieldType: 'date' })];
		const schemaService = createMockSchemaService(fields);
		const service = new ConstraintService(schemaService);

		const violations = await service.validate('table-1', { due: 'not-a-date' });

		expect(violations).toHaveLength(1);
		expect(violations[0].code).toBe('INVALID_FIELD_TYPE');
	});

	it('returns INVALID_FIELD_TYPE for multi_select with non-array', async () => {
		const fields = [makeField({
			slug: 'tags',
			name: 'Tags',
			fieldType: 'multi_select',
			options: [{ value: 'a' }, { value: 'b' }],
		})];
		const schemaService = createMockSchemaService(fields);
		const service = new ConstraintService(schemaService);

		const violations = await service.validate('table-1', { tags: 'not-an-array' });

		expect(violations).toHaveLength(1);
		expect(violations[0].code).toBe('INVALID_FIELD_TYPE');
	});

	it('returns VALIDATION_ERROR for number below min', async () => {
		const fields = [makeField({
			slug: 'score',
			name: 'Score',
			fieldType: 'number',
			validation: { min: 0 },
		})];
		const schemaService = createMockSchemaService(fields);
		const service = new ConstraintService(schemaService);

		const violations = await service.validate('table-1', { score: -5 });

		expect(violations).toHaveLength(1);
		expect(violations[0].code).toBe('VALIDATION_ERROR');
		expect(violations[0].message).toContain('at least 0');
	});

	it('returns VALIDATION_ERROR for number above max', async () => {
		const fields = [makeField({
			slug: 'score',
			name: 'Score',
			fieldType: 'number',
			validation: { max: 100 },
		})];
		const schemaService = createMockSchemaService(fields);
		const service = new ConstraintService(schemaService);

		const violations = await service.validate('table-1', { score: 150 });

		expect(violations).toHaveLength(1);
		expect(violations[0].code).toBe('VALIDATION_ERROR');
		expect(violations[0].message).toContain('at most 100');
	});

	it('returns VALIDATION_ERROR for string below min length', async () => {
		const fields = [makeField({
			slug: 'name',
			name: 'Name',
			fieldType: 'text',
			validation: { min: 3 },
		})];
		const schemaService = createMockSchemaService(fields);
		const service = new ConstraintService(schemaService);

		const violations = await service.validate('table-1', { name: 'ab' });

		expect(violations).toHaveLength(1);
		expect(violations[0].code).toBe('VALIDATION_ERROR');
		expect(violations[0].message).toContain('at least 3 characters');
	});

	it('returns VALIDATION_ERROR for string above max length', async () => {
		const fields = [makeField({
			slug: 'name',
			name: 'Name',
			fieldType: 'text',
			validation: { max: 5 },
		})];
		const schemaService = createMockSchemaService(fields);
		const service = new ConstraintService(schemaService);

		const violations = await service.validate('table-1', { name: 'too long string' });

		expect(violations).toHaveLength(1);
		expect(violations[0].code).toBe('VALIDATION_ERROR');
		expect(violations[0].message).toContain('at most 5 characters');
	});

	it('returns VALIDATION_ERROR for string not matching pattern', async () => {
		const fields = [makeField({
			slug: 'code',
			name: 'Code',
			fieldType: 'text',
			validation: { pattern: '^[A-Z]{3}-\\d{3}$' },
		})];
		const schemaService = createMockSchemaService(fields);
		const service = new ConstraintService(schemaService);

		const violations = await service.validate('table-1', { code: 'invalid' });

		expect(violations).toHaveLength(1);
		expect(violations[0].code).toBe('VALIDATION_ERROR');
		expect(violations[0].message).toContain('pattern');
	});

	it('accepts semantic email pattern alias for valid emails', async () => {
		const fields = [makeField({
			slug: 'contact_email',
			name: 'Contact Email',
			fieldType: 'text',
			validation: { pattern: 'email' },
		})];
		const schemaService = createMockSchemaService(fields);
		const service = new ConstraintService(schemaService);

		const violations = await service.validate('table-1', { contact_email: 'valid@example.com' });

		expect(violations).toHaveLength(0);
	});

	it('returns VALIDATION_ERROR for semantic email pattern alias mismatch', async () => {
		const fields = [makeField({
			slug: 'contact_email',
			name: 'Contact Email',
			fieldType: 'text',
			validation: { pattern: 'email' },
		})];
		const schemaService = createMockSchemaService(fields);
		const service = new ConstraintService(schemaService);

		const violations = await service.validate('table-1', { contact_email: 'invalid-email' });

		expect(violations).toHaveLength(1);
		expect(violations[0].code).toBe('VALIDATION_ERROR');
		expect(violations[0].message).toContain('pattern');
	});

	it('allows valid state machine transition with no violations', async () => {
		const fields = [makeField({
			slug: 'status',
			name: 'Status',
			fieldType: 'select',
			options: [{ value: 'draft' }, { value: 'review' }, { value: 'published' }],
			constraints: {
				transitions: {
					draft: ['review'],
					review: ['published', 'draft'],
					published: [],
				},
			},
		})];
		const schemaService = createMockSchemaService(fields);
		const service = new ConstraintService(schemaService);

		const violations = await service.validate(
			'table-1',
			{ status: 'review' },
			{ status: 'draft' },
		);

		const transitionViolations = violations.filter((v) => v.code === 'INVALID_STATE_TRANSITION');
		expect(transitionViolations).toHaveLength(0);
	});

	it('returns INVALID_STATE_TRANSITION for disallowed state transition', async () => {
		const fields = [makeField({
			slug: 'status',
			name: 'Status',
			fieldType: 'select',
			options: [{ value: 'draft' }, { value: 'review' }, { value: 'published' }],
			constraints: {
				transitions: {
					draft: ['review'],
					review: ['published', 'draft'],
					published: [],
				},
			},
		})];
		const schemaService = createMockSchemaService(fields);
		const service = new ConstraintService(schemaService);

		const violations = await service.validate(
			'table-1',
			{ status: 'published' },
			{ status: 'draft' },
		);

		expect(violations.some((v) => v.code === 'INVALID_STATE_TRANSITION')).toBe(true);
	});

	it('returns INVALID_OPTION for select with invalid option', async () => {
		const fields = [makeField({
			slug: 'priority',
			name: 'Priority',
			fieldType: 'select',
			options: [{ value: 'low' }, { value: 'medium' }, { value: 'high' }],
		})];
		const schemaService = createMockSchemaService(fields);
		const service = new ConstraintService(schemaService);

		const violations = await service.validate('table-1', { priority: 'urgent' });

		expect(violations).toHaveLength(1);
		expect(violations[0].code).toBe('INVALID_OPTION');
	});

	it('returns INVALID_OPTION for multi_select with invalid option', async () => {
		const fields = [makeField({
			slug: 'tags',
			name: 'Tags',
			fieldType: 'multi_select',
			options: [{ value: 'bug' }, { value: 'feature' }, { value: 'docs' }],
		})];
		const schemaService = createMockSchemaService(fields);
		const service = new ConstraintService(schemaService);

		const violations = await service.validate('table-1', { tags: ['bug', 'invalid-tag'] });

		expect(violations.some((v) => v.code === 'INVALID_OPTION')).toBe(true);
	});

	it('returns empty violations for valid data', async () => {
		const fields = [
			makeField({ slug: 'name', name: 'Name', fieldType: 'text', isRequired: true }),
			makeField({ slug: 'email', name: 'Email', fieldType: 'email' }),
			makeField({ slug: 'age', name: 'Age', fieldType: 'number', validation: { min: 0, max: 150 } }),
		];
		const schemaService = createMockSchemaService(fields);
		const service = new ConstraintService(schemaService);

		const violations = await service.validate('table-1', {
			name: 'John Doe',
			email: 'john@example.com',
			age: 30,
		});

		expect(violations).toHaveLength(0);
	});
});
