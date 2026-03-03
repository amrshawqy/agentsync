import type { ProvenanceEntry } from '@agentsync/types';

export class ProvenanceService {
	buildProvenance(
		data: Record<string, unknown>,
		agentId: string,
		confidence: number = 1.0,
	): Record<string, ProvenanceEntry> {
		const now = new Date().toISOString();
		const provenance: Record<string, ProvenanceEntry> = {};

		for (const field of Object.keys(data)) {
			provenance[field] = {
				agent: agentId,
				at: now,
				confidence,
			};
		}

		return provenance;
	}

	mergeProvenance(
		existing: Record<string, ProvenanceEntry>,
		updates: Record<string, unknown>,
		agentId: string,
		confidence: number = 1.0,
	): Record<string, ProvenanceEntry> {
		const now = new Date().toISOString();
		const merged = { ...existing };

		for (const field of Object.keys(updates)) {
			merged[field] = {
				agent: agentId,
				at: now,
				confidence,
			};
		}

		return merged;
	}

	addVerification(
		provenance: Record<string, ProvenanceEntry>,
		field: string,
		verification: {
			by: string;
			method: string;
			outcome: 'valid' | 'invalid' | 'unconfirmed';
		},
	): Record<string, ProvenanceEntry> {
		const entry = provenance[field];
		if (!entry) return provenance;

		return {
			...provenance,
			[field]: {
				...entry,
				verification: {
					by: verification.by,
					method: verification.method,
					date: new Date().toISOString(),
					outcome: verification.outcome,
				},
			},
		};
	}
}
