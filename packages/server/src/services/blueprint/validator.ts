import type { BlueprintSchemaDefinition } from '@agentsync/types';
import { FieldType } from '@agentsync/types';

export interface ValidationResult {
	valid: boolean;
	errors: string[];
}

export function validateBlueprintSchema(schema: BlueprintSchemaDefinition): ValidationResult {
	const errors: string[] = [];
	const tableSlugs = new Set<string>();

	if (!schema.tables || !Array.isArray(schema.tables)) {
		return { valid: false, errors: ['Blueprint must have a tables array'] };
	}

	for (const table of schema.tables) {
		if (!table.slug) {
			errors.push('Every table must have a slug');
			continue;
		}

		if (tableSlugs.has(table.slug)) {
			errors.push(`Duplicate table slug: ${table.slug}`);
		}
		tableSlugs.add(table.slug);

		if (!table.name) {
			errors.push(`Table '${table.slug}' must have a name`);
		}

		if (!table.fields || !Array.isArray(table.fields)) {
			errors.push(`Table '${table.slug}' must have a fields array`);
			continue;
		}

		const fieldSlugs = new Set<string>();
		for (const field of table.fields) {
			if (!field.slug) {
				errors.push(`Table '${table.slug}': every field must have a slug`);
				continue;
			}

			if (fieldSlugs.has(field.slug)) {
				errors.push(`Table '${table.slug}': duplicate field slug '${field.slug}'`);
			}
			fieldSlugs.add(field.slug);

			if (!field.fieldType) {
				errors.push(`Table '${table.slug}', field '${field.slug}': missing fieldType`);
			} else {
				const result = FieldType.safeParse(field.fieldType);
				if (!result.success) {
					errors.push(
						`Table '${table.slug}', field '${field.slug}': invalid fieldType '${field.fieldType}'`,
					);
				}
			}
		}
	}

	return { valid: errors.length === 0, errors };
}
