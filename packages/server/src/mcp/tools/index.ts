import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ServiceContainer } from '../../services/index.js';
import { registerAuthTools } from './auth.js';
import { registerAutomationTools } from './automation.js';
import { registerBlueprintTools } from './blueprint.js';
import { registerDataTools } from './data.js';
import { registerEventTools } from './event.js';
import { registerMemberTools } from './member.js';
import { registerSchemaTools } from './schema.js';
import { type AuthContextGetter, createHelpers } from './shared.js';
import { registerSuggestionTools } from './suggestion.js';
import { registerUtilityTools } from './utility.js';

export type { AuthContextGetter };

export function registerTools(
	mcp: McpServer,
	services: ServiceContainer,
	getAuthContext?: AuthContextGetter,
) {
	const h = createHelpers(services, getAuthContext);
	registerDataTools(mcp, h);
	registerSchemaTools(mcp, h);
	registerBlueprintTools(mcp, h);
	registerEventTools(mcp, h);
	registerSuggestionTools(mcp, h);
	registerMemberTools(mcp, h);
	registerAutomationTools(mcp, h);
	registerAuthTools(mcp, h);
	registerUtilityTools(mcp, h);
}
