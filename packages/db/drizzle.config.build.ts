import { defineConfig } from 'drizzle-kit';

export default defineConfig({
	schema: './dist/schema/*.js',
	out: './drizzle',
	dialect: 'postgresql',
	dbCredentials: {
		url: process.env.DATABASE_URL ?? 'postgresql://agentsync:agentsync@localhost:5432/agentsync',
	},
});
