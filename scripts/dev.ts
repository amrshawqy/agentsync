#!/usr/bin/env tsx
/**
 * Development startup script.
 * Starts Docker services, runs migrations, seeds data, and starts the server.
 */
import { execSync } from 'node:child_process';

function run(cmd: string, label: string) {
	console.log(`\n→ ${label}`);
	execSync(cmd, { stdio: 'inherit', cwd: process.cwd() });
}

async function main() {
	try {
		run('docker compose -f docker/docker-compose.yml up -d', 'Starting PostgreSQL + Redis');

		// Wait for services
		console.log('\n→ Waiting for services...');
		await new Promise((r) => setTimeout(r, 3000));

		run('pnpm db:migrate', 'Running migrations');
		run('pnpm db:seed', 'Seeding database');

		console.log('\n→ Starting server...');
		run('pnpm --filter @agentsync/server dev', 'Server');
	} catch (err) {
		console.error('Dev startup failed:', err);
		process.exit(1);
	}
}

main();
