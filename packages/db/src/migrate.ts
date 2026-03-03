import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { createMigrationClient } from './client.js';

async function main() {
	console.log('Running migrations...');

	const client = createMigrationClient();
	const db = drizzle(client);

	await migrate(db, { migrationsFolder: './drizzle' });

	console.log('Migrations complete.');
	await client.end();
	process.exit(0);
}

main().catch((err) => {
	console.error('Migration failed:', err);
	process.exit(1);
});
