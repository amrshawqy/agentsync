import { describe, expect, it } from 'vitest';
import { PaginationSchema } from '../src/api/index.js';
import { BlueprintSchema } from '../src/domain/blueprint.js';
import { RecordSchema } from '../src/domain/record.js';
import { TeamSchema } from '../src/domain/team.js';
import { UserSchema } from '../src/domain/user.js';
import { CreateRecordToolInputSchema } from '../src/mcp/index.js';

describe('TeamSchema', () => {
	it('parses a valid team object', () => {
		const input = {
			id: '550e8400-e29b-41d4-a716-446655440000',
			name: 'Acme Corp',
			slug: 'acme-corp',
			plan: 'team',
			settings: { theme: 'dark' },
			createdAt: '2024-01-01T00:00:00Z',
			updatedAt: '2024-01-01T00:00:00Z',
		};
		const result = TeamSchema.safeParse(input);

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.name).toBe('Acme Corp');
			expect(result.data.slug).toBe('acme-corp');
			expect(result.data.plan).toBe('team');
		}
	});

	it('rejects a team with missing name', () => {
		const input = {
			id: '550e8400-e29b-41d4-a716-446655440000',
			slug: 'acme-corp',
			createdAt: '2024-01-01T00:00:00Z',
			updatedAt: '2024-01-01T00:00:00Z',
		};
		const result = TeamSchema.safeParse(input);

		expect(result.success).toBe(false);
	});
});

describe('UserSchema', () => {
	it('parses a valid user', () => {
		const input = {
			id: '550e8400-e29b-41d4-a716-446655440000',
			teamId: '660e8400-e29b-41d4-a716-446655440000',
			email: 'john@example.com',
			name: 'John Doe',
			roleId: null,
			agentId: null,
			status: 'active',
			lastConnectedAt: null,
			createdAt: '2024-01-01T00:00:00Z',
		};
		const result = UserSchema.safeParse(input);

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.email).toBe('john@example.com');
			expect(result.data.status).toBe('active');
		}
	});

	it('rejects a user with invalid email', () => {
		const input = {
			id: '550e8400-e29b-41d4-a716-446655440000',
			teamId: '660e8400-e29b-41d4-a716-446655440000',
			email: 'not-an-email',
			name: 'John Doe',
			roleId: null,
			agentId: null,
			status: 'active',
			lastConnectedAt: null,
			createdAt: '2024-01-01T00:00:00Z',
		};
		const result = UserSchema.safeParse(input);

		expect(result.success).toBe(false);
	});
});

describe('RecordSchema', () => {
	it('parses a record with provenance', () => {
		const input = {
			id: '550e8400-e29b-41d4-a716-446655440000',
			teamId: '660e8400-e29b-41d4-a716-446655440000',
			tableId: '770e8400-e29b-41d4-a716-446655440000',
			data: { name: 'Test Record', status: 'active' },
			provenance: {
				name: {
					agent: 'agent-1',
					at: '2024-01-01T00:00:00Z',
					confidence: 0.95,
				},
			},
			createdBy: '880e8400-e29b-41d4-a716-446655440000',
			updatedBy: null,
			createdAt: '2024-01-01T00:00:00Z',
			updatedAt: '2024-01-01T00:00:00Z',
			deletedAt: null,
		};
		const result = RecordSchema.safeParse(input);

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.provenance.name.agent).toBe('agent-1');
			expect(result.data.provenance.name.confidence).toBe(0.95);
		}
	});
});

describe('PaginationSchema', () => {
	it('defaults limit to 50 and offset to 0', () => {
		const result = PaginationSchema.parse({});

		expect(result.limit).toBe(50);
		expect(result.offset).toBe(0);
	});

	it('rejects limit > 1000', () => {
		const result = PaginationSchema.safeParse({ limit: 1001 });

		expect(result.success).toBe(false);
	});
});

describe('CreateRecordToolInputSchema', () => {
	it('parses valid input', () => {
		const input = {
			table: 'contacts',
			data: { name: 'John', email: 'john@example.com' },
		};
		const result = CreateRecordToolInputSchema.safeParse(input);

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.table).toBe('contacts');
			expect(result.data.data).toEqual({ name: 'John', email: 'john@example.com' });
		}
	});

	it('rejects input with missing table', () => {
		const input = {
			data: { name: 'John' },
		};
		const result = CreateRecordToolInputSchema.safeParse(input);

		expect(result.success).toBe(false);
	});
});
