import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as relations from './relations.js';
import * as schema from './schema/index.js';

export type Database = ReturnType<typeof createDb>;

export function createDb(url?: string) {
	const connectionString =
		url ?? process.env.DATABASE_URL ?? 'postgresql://agentsync:agentsync@localhost:5432/agentsync';

	const client = postgres(connectionString);

	return drizzle(client, {
		schema: { ...schema, ...relations },
	});
}

export function createMigrationClient(url?: string) {
	const connectionString =
		url ?? process.env.DATABASE_URL ?? 'postgresql://agentsync:agentsync@localhost:5432/agentsync';

	return postgres(connectionString, { max: 1 });
}
