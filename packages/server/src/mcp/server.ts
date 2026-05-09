import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getConfig } from '../config.js';
import { logger } from '../infra/logger.js';
import type { ServiceContainer } from '../services/index.js';
import { registerPrompts } from './prompts/index.js';
import { registerResources } from './resources/index.js';
import { type AuthContextGetter, registerTools } from './tools/index.js';

export function createMcpServer(
	services: ServiceContainer,
	getAuthContext?: AuthContextGetter,
): McpServer {
	const config = getConfig();

	const mcp = new McpServer({
		name: config.MCP_SERVER_NAME,
		version: config.MCP_SERVER_VERSION,
	});

	registerTools(mcp, services, getAuthContext);
	registerResources(mcp, services);
	registerPrompts(mcp, services);

	logger.info('MCP server created', {
		name: config.MCP_SERVER_NAME,
		version: config.MCP_SERVER_VERSION,
	});

	return mcp;
}
