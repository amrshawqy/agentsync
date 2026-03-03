interface Skill {
	command: string;
	description: string;
	steps: Array<{
		tool: string;
		params: Record<string, unknown>;
	}>;
}

interface TableInfo {
	slug: string;
	name: string;
	fields: Array<{
		slug: string;
		name: string;
		fieldType: string;
		isRequired: boolean;
	}>;
}

export class SkillGenerator {
	generate(tables: TableInfo[]): Skill[] {
		const skills: Skill[] = [];

		for (const table of tables) {
			// Create record skill
			skills.push({
				command: `/new-${table.slug.replace(/_/g, '-')}`,
				description: `Create a new ${table.name} record`,
				steps: [
					{
						tool: 'create_record',
						params: { table: table.slug },
					},
				],
			});

			// List records skill
			skills.push({
				command: `/list-${table.slug.replace(/_/g, '-')}`,
				description: `List ${table.name} records`,
				steps: [
					{
						tool: 'query_records',
						params: { table: table.slug, limit: 20 },
					},
				],
			});

			// Find skills for select fields (group by)
			const selectFields = table.fields.filter(
				(f) => f.fieldType === 'select' || f.fieldType === 'multi_select',
			);

			for (const field of selectFields) {
				skills.push({
					command: `/${table.slug.replace(/_/g, '-')}-by-${field.slug.replace(/_/g, '-')}`,
					description: `Show ${table.name} grouped by ${field.name}`,
					steps: [
						{
							tool: 'query_records',
							params: { table: table.slug, group_by: field.slug },
						},
					],
				});
			}
		}

		return skills;
	}
}
