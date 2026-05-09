import type { Database } from '@agentsync/db';
import { recordIndexes, schemaFields } from '@agentsync/db';
import { and, eq } from 'drizzle-orm';

export class IndexService {
	constructor(private db: Database) {}

	async updateIndexes(
		recordId: string,
		teamId: string,
		tableId: string,
		data: Record<string, unknown>,
		tx?: any,
	): Promise<void> {
		const executor = tx ?? this.db;

		// Get indexed fields for this table
		const fields = await this.db
			.select()
			.from(schemaFields)
			.where(and(eq(schemaFields.tableId, tableId), eq(schemaFields.isIndexed, true)));

		for (const field of fields) {
			const value = data[field.slug];
			if (value === undefined) continue;

			const indexEntry = {
				recordId,
				teamId,
				tableId,
				fieldId: field.id,
				textValue: null as string | null,
				numberValue: null as string | null,
				dateValue: null as Date | null,
				boolValue: null as boolean | null,
			};

			switch (field.fieldType) {
				case 'text':
				case 'email':
				case 'url':
				case 'phone':
				case 'select':
				case 'user':
					indexEntry.textValue = value != null ? String(value) : null;
					break;
				case 'json':
					indexEntry.textValue =
						value != null ? (typeof value === 'string' ? value : JSON.stringify(value)) : null;
					break;
				case 'number':
				case 'currency':
					indexEntry.numberValue = value != null ? String(value) : null;
					break;
				case 'date':
				case 'datetime':
					indexEntry.dateValue = value != null ? new Date(value as string) : null;
					break;
				case 'boolean':
					indexEntry.boolValue = value != null ? Boolean(value) : null;
					break;
				case 'rollup':
				case 'attachment':
					// Computed/complex fields — skip indexing
					break;
			}

			await executor
				.insert(recordIndexes)
				.values(indexEntry)
				.onConflictDoUpdate({
					target: [recordIndexes.recordId, recordIndexes.fieldId],
					set: {
						textValue: indexEntry.textValue,
						numberValue: indexEntry.numberValue,
						dateValue: indexEntry.dateValue,
						boolValue: indexEntry.boolValue,
					},
				});
		}
	}

	async deleteIndexes(recordId: string, tx?: any): Promise<void> {
		const executor = tx ?? this.db;
		await executor.delete(recordIndexes).where(eq(recordIndexes.recordId, recordId));
	}
}
