#!/usr/bin/env tsx
import { execSync } from 'node:child_process';

function run(cmd: string, label: string) {
	console.log(`\n→ ${label}`);
	execSync(cmd, { stdio: 'inherit', cwd: process.cwd() });
}

async function main() {
	try {
		run('pnpm db:generate', 'Generating migration SQL');
		run('pnpm db:migrate', 'Running migrations');
		console.log('\n✓ Migrations complete');
	} catch (err) {
		console.error('Migration failed:', err);
		process.exit(1);
	}
}

main();
