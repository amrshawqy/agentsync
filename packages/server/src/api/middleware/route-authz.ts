import type { RequestContext } from '@agentsync/types';
import { hasAdminAccess } from '../../services/auth/admin-access.js';
import type { ServiceContainer } from '../../services/index.js';

export function getRequestContext(c: any): RequestContext {
	return {
		teamId: c.get('teamId'),
		userId: c.get('userId'),
		roleId: c.get('roleId'),
		accountId: c.get('accountId'),
		agentId: c.get('agentId'),
		limitsTier: c.get('limitsTier'),
		permissions: {},
	};
}

export async function requireAdmin(c: any, services: ServiceContainer): Promise<Response | null> {
	const ctx = getRequestContext(c);
	const allowed = await hasAdminAccess(services.permission, ctx);
	if (!allowed) {
		return c.json({ error: { code: 'FORBIDDEN', message: 'Admin role required' } }, 403);
	}
	return null;
}
