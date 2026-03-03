#!/usr/bin/env tsx
/**
 * Full seed script — system roles + built-in blueprints.
 */
import { execSync } from 'node:child_process';

execSync('pnpm --filter @agentsync/db seed', { stdio: 'inherit' });

// Seed blueprints
import('../packages/db/src/seed/blueprints.js')
	.then((m) => m.seedBlueprints())
	.then(() => {
		console.log('All seeds complete.');
		process.exit(0);
	})
	.catch((err) => {
		console.error('Seed failed:', err);
		process.exit(1);
	});
