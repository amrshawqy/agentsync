import type { Database } from '@agentsync/db';
import { fieldSuggestions } from '@agentsync/db';
import type { CreateFieldSuggestion } from '@agentsync/types';
import { and, eq } from 'drizzle-orm';
import type { SchemaService } from '../schema/schema.service.js';

export class SuggestionService {
	constructor(
		private db: Database,
		private schemaService: SchemaService,
	) {}

	async suggest(teamId: string, userId: string, input: CreateFieldSuggestion) {
		const [suggestion] = await this.db
			.insert(fieldSuggestions)
			.values({
				teamId,
				tableId: input.tableId,
				suggestedBy: userId,
				fieldName: input.fieldName,
				fieldSlug: input.fieldSlug,
				fieldType: input.fieldType,
				agentHint: input.agentHint,
				rationale: input.rationale,
				exampleValue: input.exampleValue,
			})
			.returning();

		return suggestion;
	}

	async approve(suggestionId: string, teamId: string, reviewerId: string, note?: string) {
		const [suggestion] = await this.db
			.select()
			.from(fieldSuggestions)
			.where(and(eq(fieldSuggestions.id, suggestionId), eq(fieldSuggestions.teamId, teamId)));

		if (!suggestion) throw new Error('Suggestion not found');

		// Create the field
		await this.schemaService.createField(teamId, suggestion.tableId, {
			name: suggestion.fieldName,
			slug: suggestion.fieldSlug,
			fieldType: suggestion.fieldType as any,
			agentHint: suggestion.agentHint ?? undefined,
			sourceLayer: 'workspace',
		});

		// Update suggestion status
		const [updated] = await this.db
			.update(fieldSuggestions)
			.set({
				status: 'approved',
				reviewedBy: reviewerId,
				reviewNote: note,
				reviewedAt: new Date(),
			})
			.where(eq(fieldSuggestions.id, suggestionId))
			.returning();

		return updated;
	}

	async reject(suggestionId: string, teamId: string, reviewerId: string, note?: string) {
		const [updated] = await this.db
			.update(fieldSuggestions)
			.set({
				status: 'rejected',
				reviewedBy: reviewerId,
				reviewNote: note,
				reviewedAt: new Date(),
			})
			.where(and(eq(fieldSuggestions.id, suggestionId), eq(fieldSuggestions.teamId, teamId)))
			.returning();

		return updated ?? null;
	}

	async listPending(teamId: string) {
		return this.db
			.select()
			.from(fieldSuggestions)
			.where(and(eq(fieldSuggestions.teamId, teamId), eq(fieldSuggestions.status, 'pending')));
	}

	async listPendingByUser(teamId: string, userId: string) {
		return this.db
			.select()
			.from(fieldSuggestions)
			.where(
				and(
					eq(fieldSuggestions.teamId, teamId),
					eq(fieldSuggestions.suggestedBy, userId),
					eq(fieldSuggestions.status, 'pending'),
				),
			);
	}

	async listAll(teamId: string) {
		return this.db.select().from(fieldSuggestions).where(eq(fieldSuggestions.teamId, teamId));
	}

	async listByUser(teamId: string, userId: string) {
		return this.db
			.select()
			.from(fieldSuggestions)
			.where(and(eq(fieldSuggestions.teamId, teamId), eq(fieldSuggestions.suggestedBy, userId)));
	}
}
