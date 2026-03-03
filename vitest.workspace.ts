import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
	'packages/types',
	'packages/db',
	'packages/server',
	'packages/sdk',
]);
