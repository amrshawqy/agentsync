import { createDb } from '@agentsync/db';
import { serve } from '@hono/node-server';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger as honoLogger } from 'hono/logger';
import { authMiddleware } from './api/middleware/auth.js';
import { errorHandler } from './api/middleware/error-handler.js';
import { createRateLimitMiddleware } from './api/middleware/rate-limit.js';
import { requestIdMiddleware } from './api/middleware/request-id.js';
import { createTeamContextMiddleware } from './api/middleware/team-context.js';
import { createAdminRoutes } from './api/routes/admin.js';
import { createAgentKitRoutes } from './api/routes/agent-kit.js';
import { createAuditRoutes } from './api/routes/audit.js';
import { createAuthRoutes } from './api/routes/auth.js';
import { createAutomationRoutes } from './api/routes/automations.js';
import { createBlueprintRoutes } from './api/routes/blueprints.js';
import { createEventRoutes } from './api/routes/events.js';
import { createExplainRoutes } from './api/routes/explain.js';
import { createHealthRoutes } from './api/routes/health.js';
import { createInstructionRoutes } from './api/routes/instructions.js';
import { createMarketplaceRoutes } from './api/routes/marketplace.js';
import { createMemberRoutes } from './api/routes/members.js';
import { createRecordRoutes } from './api/routes/records.js';
import { createSchemaRoutes } from './api/routes/schema.js';
import { createSuggestionRoutes } from './api/routes/suggestions.js';
import { createTeamRoutes } from './api/routes/teams.js';
import { createUploadRoutes } from './api/routes/uploads.js';
import { createWorkspaceRoutes } from './api/routes/workspaces.js';
import { getConfig } from './config.js';
import { logger } from './infra/logger.js';
import { closeRedis, getRedis } from './infra/redis.js';
import { createMcpServer } from './mcp/server.js';
import { createOAuthRoutes } from './services/auth/oauth-server.js';
import { createServices } from './services/index.js';

async function main() {
	const config = getConfig();

	// Initialize infrastructure
	const db = createDb(config.DATABASE_URL);
	const redis = getRedis();
	await redis.connect();

	// Create services
	const services = createServices(db, redis);

	// Create Hono app
	const app = new Hono();

	// Global middleware
	app.use('*', requestIdMiddleware());
	app.use('*', cors());
	app.use('*', honoLogger());
	app.onError(errorHandler);

	// Rate limiting for API routes
	const rateLimiter = createRateLimitMiddleware(services.cache);
	app.use('/v1/*', rateLimiter);

	// Public and mixed-auth onboarding routes.
	app.route('/v1/auth', createAuthRoutes(services));

	// Authenticate API routes before team context assignment
	app.use('/v1/*', authMiddleware);

	// Set Postgres session variable for RLS org isolation
	const teamContext = createTeamContextMiddleware(db);
	app.use('/v1/*', teamContext);

	// Mount routes
	app.route('/', createHealthRoutes(services));
	app.route('/oauth', createOAuthRoutes(services.auth));
	app.route('/v1/records', createRecordRoutes(services));
	app.route('/v1/schema', createSchemaRoutes(services));
	app.route('/v1/workspaces', createWorkspaceRoutes(services));
	app.route('/v1/teams', createTeamRoutes(services));
	app.route('/v1/members', createMemberRoutes(services));
	app.route('/v1/blueprints', createBlueprintRoutes(services));
	app.route('/v1/events', createEventRoutes(services));
	app.route('/v1/instructions', createInstructionRoutes(services));
	app.route('/v1/agent-kit', createAgentKitRoutes(services));
	app.route('/v1/suggestions', createSuggestionRoutes(services));
	app.route('/v1/audit', createAuditRoutes(services));
	app.route('/v1/automations', createAutomationRoutes(services));
	app.route('/v1/marketplace', createMarketplaceRoutes(services));
	app.route('/v1/uploads', createUploadRoutes(services));
	app.route('/v1/explain', createExplainRoutes(services));
	app.route('/v1/admin', createAdminRoutes(services, db));

	const protectedResourceMetadataPath = '/.well-known/oauth-protected-resource';
	const authServerMetadataPath = '/.well-known/oauth-authorization-server';

	app.get(protectedResourceMetadataPath, (c) => {
		return c.json({
			resource: `${config.PUBLIC_BASE_URL}/mcp`,
			authorization_servers: [config.PUBLIC_BASE_URL],
			bearer_methods_supported: ['header'],
			scopes_supported: ['mcp:tools', 'mcp:resources'],
			resource_documentation: `${config.PUBLIC_BASE_URL}/docs`,
		});
	});

	app.get(authServerMetadataPath, (c) => {
		return c.json({
			issuer: config.PUBLIC_BASE_URL,
			authorization_endpoint: `${config.PUBLIC_BASE_URL}/oauth/authorize`,
			token_endpoint: `${config.PUBLIC_BASE_URL}/oauth/token`,
			registration_endpoint: `${config.PUBLIC_BASE_URL}/oauth/register`,
			revocation_endpoint: `${config.PUBLIC_BASE_URL}/oauth/revoke`,
			device_authorization_endpoint: `${config.PUBLIC_BASE_URL}/oauth/device/authorize`,
			grant_types_supported: [
				'authorization_code',
				'refresh_token',
				'urn:ietf:params:oauth:grant-type:device_code',
			],
			response_types_supported: ['code'],
			code_challenge_methods_supported: ['S256'],
			token_endpoint_auth_methods_supported: ['client_secret_post', 'none'],
			scopes_supported: ['mcp:tools', 'mcp:resources'],
		});
	});

	const wwwAuthHeader = `Bearer realm="agentsync", resource_metadata="${config.PUBLIC_BASE_URL}${protectedResourceMetadataPath}"`;

	app.all('/mcp', async (c) => {
		// Extract auth from Bearer token
		const authHeader = c.req.header('Authorization');
		if (!authHeader?.startsWith('Bearer ')) {
			c.header('WWW-Authenticate', wwwAuthHeader);
			return c.json({ error: { code: 'UNAUTHORIZED', message: 'Missing Bearer token' } }, 401);
		}

		const { verifyJwt } = await import('./services/auth/jwt.js');
		let authContext: import('@agentsync/types').RequestContext;
		try {
			const payload = await verifyJwt(authHeader.slice(7));
			authContext = {
				teamId: (payload.team as string) ?? '',
				userId: (payload.sub as string) ?? '',
				roleId: (payload.role as string) ?? '',
				accountId: (payload.account_id as string) ?? undefined,
				agentId: (payload.agent_id as string) ?? undefined,
				limitsTier: (payload.limits_tier as 'unverified' | 'verified') ?? undefined,
				permissions: {},
			};
		} catch {
			c.header('WWW-Authenticate', `${wwwAuthHeader}, error="invalid_token"`);
			return c.json({ error: { code: 'INVALID_TOKEN', message: 'Invalid or expired token' } }, 401);
		}

		// Build MCP server per request to avoid cross-request auth context bleed.
		const mcpServer = createMcpServer(services, () => authContext);
		const transport = new WebStandardStreamableHTTPServerTransport({
			sessionIdGenerator: undefined,
		});

		if (authContext.teamId) {
			await db.execute(sql`SELECT set_config('app.current_team_id', ${authContext.teamId}, false)`);
		}

		try {
			await mcpServer.connect(transport);
			return await transport.handleRequest(c.req.raw);
		} finally {
			if (authContext.teamId) {
				await db.execute(sql.raw('RESET app.current_team_id'));
			}
		}
	});

	// Bootstrap admin: print one-time setup token if no super-admin exists.
	await services.bootstrap.onServerStart();

	// Start server
	// Start automation engine
	await services.automationEngine.start();

	serve(
		{
			fetch: app.fetch,
			port: config.PORT,
			hostname: config.HOST,
		},
		(info) => {
			logger.info('AgentSync server started', {
				port: info.port,
				host: config.HOST,
				env: config.NODE_ENV,
			});
			logger.info(`REST API: http://localhost:${info.port}/v1`);
			logger.info(`MCP endpoint: http://localhost:${info.port}/mcp`);
			logger.info(`Health check: http://localhost:${info.port}/health`);
		},
	);

	// Graceful shutdown
	const shutdown = async () => {
		logger.info('Shutting down...');
		await services.automationEngine.stop();
		await closeRedis();
		process.exit(0);
	};

	process.on('SIGINT', shutdown);
	process.on('SIGTERM', shutdown);
}

main().catch((err) => {
	logger.error('Failed to start server', { error: String(err) });
	process.exit(1);
});
