import { createDb } from '../client.js';
import { teams, roles, users, oauthClients, instructions } from '../schema/index.js';

async function seed() {
	console.log('Seeding database...');

	const db = createDb();

	// Create default team
	const [team] = await db
		.insert(teams)
		.values({
			name: 'Default Team',
			slug: 'default',
			plan: 'free',
			settings: {},
		})
		.onConflictDoNothing()
		.returning();

	if (!team) {
		console.log('Default team already exists, skipping seed.');
		process.exit(0);
	}

	// Create system roles
	const systemRoles = [
		{
			teamId: team.id,
			name: 'admin',
			isSystem: true,
			permissions: {
				'*': {
					tables: {
						'*': {
							actions: ['create', 'read', 'update', 'delete'],
						},
					},
				},
			},
		},
		{
			teamId: team.id,
			name: 'member',
			isSystem: true,
			permissions: {
				'*': {
					tables: {
						'*': {
							actions: ['create', 'read', 'update'],
							record_filters: {
								write: { created_by: '$current_user' },
							},
						},
					},
				},
			},
		},
		{
			teamId: team.id,
			name: 'viewer',
			isSystem: true,
			permissions: {
				'*': {
					tables: {
						'*': {
							actions: ['read'],
						},
					},
				},
			},
		},
	];

	const insertedRoles = await db.insert(roles).values(systemRoles).returning();
	const adminRole = insertedRoles.find((r) => r.name === 'admin')!;
	const memberRole = insertedRoles.find((r) => r.name === 'member')!;
	const viewerRole = insertedRoles.find((r) => r.name === 'viewer')!;

	// Create default admin user
	await db.insert(users).values({
		teamId: team.id,
		email: 'admin@agentsync.local',
		name: 'Admin',
		roleId: adminRole.id,
		status: 'active',
	});

	// Create test member user
	await db.insert(users).values({
		teamId: team.id,
		email: 'member@agentsync.local',
		name: 'Member User',
		roleId: memberRole.id,
		status: 'active',
	});

	// Create test viewer user
	await db.insert(users).values({
		teamId: team.id,
		email: 'viewer@agentsync.local',
		name: 'Viewer User',
		roleId: viewerRole.id,
		status: 'active',
	});

	// Create dev OAuth client for local development
	await db.insert(oauthClients).values({
		teamId: team.id,
		clientId: 'agentsync-dev-client',
		clientSecret: 'dev-secret-change-in-production',
		name: 'AgentSync Dev Client',
		redirectUris: [
			'http://localhost:3000/callback',
			'http://localhost:5173/callback',
		],
		isConfidential: true,
	});

	// Create default team instructions
	await db.insert(instructions).values([
		{
			teamId: team.id,
			scope: 'team',
			instructionType: 'context',
			content: 'You are an AI agent working within the AgentSync platform. You have access to structured data across workspaces. Always verify data provenance before trusting field values. Use confidence scores when creating or updating records.',
			priority: 10,
			isActive: true,
		},
		{
			teamId: team.id,
			scope: 'team',
			instructionType: 'guardrail',
			content: 'Never delete records without explicit user confirmation. Do not modify records owned by other agents unless you have write permission. Always provide a reason when updating record status through state transitions.',
			priority: 20,
			isActive: true,
		},
	]);

	console.log('Seed complete:');
	console.log(`  Team: ${team.name} (${team.id})`);
	console.log(`  Roles: ${insertedRoles.map((r) => r.name).join(', ')}`);
	console.log('  Admin user: admin@agentsync.local');
	console.log('  Member user: member@agentsync.local');
	console.log('  Viewer user: viewer@agentsync.local');
	console.log('  OAuth client: agentsync-dev-client');
	console.log('  Instructions: 2 team-level (context + guardrail)');

	process.exit(0);
}

seed().catch((err) => {
	console.error('Seed failed:', err);
	process.exit(1);
});
