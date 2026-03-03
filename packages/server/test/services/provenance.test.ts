import { describe, it, expect } from 'vitest';
import { ProvenanceService } from '../../src/services/data/provenance.service.js';

describe('ProvenanceService', () => {
	const service = new ProvenanceService();

	describe('buildProvenance', () => {
		it('creates an entry for each field in data', () => {
			const data = { name: 'John', email: 'john@example.com', age: 30 };
			const result = service.buildProvenance(data, 'agent-1');

			expect(Object.keys(result)).toHaveLength(3);
			expect(result).toHaveProperty('name');
			expect(result).toHaveProperty('email');
			expect(result).toHaveProperty('age');
		});

		it('uses the given agent and confidence', () => {
			const data = { name: 'John' };
			const result = service.buildProvenance(data, 'agent-scraper', 0.75);

			expect(result.name.agent).toBe('agent-scraper');
			expect(result.name.confidence).toBe(0.75);
			expect(result.name.at).toBeDefined();
		});

		it('defaults confidence to 1.0', () => {
			const data = { name: 'John' };
			const result = service.buildProvenance(data, 'agent-1');

			expect(result.name.confidence).toBe(1.0);
		});
	});

	describe('mergeProvenance', () => {
		it('updates changed fields only', () => {
			const existing = service.buildProvenance({ name: 'John', email: 'john@example.com' }, 'agent-1');
			const originalNameAt = existing.name.at;

			// Small delay to ensure different timestamps
			const updates = { email: 'john.doe@example.com' };
			const result = service.mergeProvenance(existing, updates, 'agent-2', 0.9);

			expect(result.email.agent).toBe('agent-2');
			expect(result.email.confidence).toBe(0.9);
		});

		it('preserves existing unchanged fields', () => {
			const existing = service.buildProvenance({ name: 'John', email: 'john@example.com' }, 'agent-1');

			const updates = { email: 'john.doe@example.com' };
			const result = service.mergeProvenance(existing, updates, 'agent-2');

			expect(result.name.agent).toBe('agent-1');
			expect(result.name.confidence).toBe(1.0);
		});
	});

	describe('addVerification', () => {
		it('adds verification to existing field', () => {
			const provenance = service.buildProvenance({ email: 'john@example.com' }, 'agent-1');
			const result = service.addVerification(provenance, 'email', {
				by: 'validator-agent',
				method: 'dns-check',
				outcome: 'valid',
			});

			expect(result.email.verification).toBeDefined();
			expect(result.email.verification!.by).toBe('validator-agent');
			expect(result.email.verification!.method).toBe('dns-check');
			expect(result.email.verification!.outcome).toBe('valid');
			expect(result.email.verification!.date).toBeDefined();
		});

		it('returns provenance unchanged for non-existent field', () => {
			const provenance = service.buildProvenance({ name: 'John' }, 'agent-1');
			const result = service.addVerification(provenance, 'nonexistent', {
				by: 'validator',
				method: 'check',
				outcome: 'valid',
			});

			expect(result).toEqual(provenance);
			expect(result).not.toHaveProperty('nonexistent');
		});
	});
});
