import { createDb } from '../client.js';
import { blueprints } from '../schema/index.js';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const blueprintsDir = join(__dirname, '..', '..', '..', '..', 'blueprints');

const BLUEPRINT_FILES = ['crm.json', 'pm.json', 'hr.json', 'support.json', 'inventory.json', 'finance.json'];

export async function seedBlueprints() {
	console.log('Seeding built-in blueprints...');
	const db = createDb();

	for (const file of BLUEPRINT_FILES) {
		try {
			const raw = readFileSync(join(blueprintsDir, file), 'utf-8');
			const bp = JSON.parse(raw);

			await db
				.insert(blueprints)
				.values({
					slug: bp.slug,
					name: bp.name,
					description: bp.description,
					category: bp.category,
					version: bp.version ?? 1,
					isBuiltin: true,
					schemaDefinition: { tables: bp.tables },
					seedData: bp.seedData ?? null,
					instructions: bp.instructions ?? null,
					isPublished: true,
					marketplaceTags: [bp.category, bp.slug],
				})
				.onConflictDoNothing();

			console.log(`  Seeded blueprint: ${bp.name}`);
		} catch (err) {
			console.error(`  Failed to seed ${file}:`, err);
		}
	}

	console.log('Blueprint seeding complete.');
}

// Run directly
if (process.argv[1]?.includes('blueprints')) {
	seedBlueprints()
		.then(() => process.exit(0))
		.catch((err) => {
			console.error(err);
			process.exit(1);
		});
}
