import { beforeEach, describe, expect, it } from 'vitest';
import { registerTools } from '../../src/mcp/tools/index.js';
import {
	createAuthContextGetter,
	createMockMcpServer,
	createMockServiceContainer,
	getResultJson,
} from './setup.js';

describe('Onboarding MCP tools', () => {
	const mcp = createMockMcpServer();
	const services = createMockServiceContainer();
	const getAuth = createAuthContextGetter();

	beforeEach(() => {
		registerTools(mcp as any, services as any, getAuth);
	});

	it('register_agent_identity returns challenge payload when challengeId is omitted', async () => {
		const result = await mcp.invokeTool('register_agent_identity', {
			publicKeyJwk: { kty: 'EC', crv: 'P-256', x: 'x', y: 'y' },
			label: 'OpenClaw Agent',
		});

		const payload = getResultJson(result as any) as Record<string, unknown>;
		expect(payload.step).toBe('sign_challenge');
		expect(services.agentIdentity.createChallenge).toHaveBeenCalledTimes(1);
	});

	it('create_team creates membership and returns team token', async () => {
		const result = await mcp.invokeTool('create_team', {
			name: 'Acme Team',
			slug: 'acme-team',
		});
		const payload = getResultJson(result as any) as Record<string, unknown>;

		expect(services.team.create).toHaveBeenCalledWith({ name: 'Acme Team', slug: 'acme-team' });
		expect(services.user.create).toHaveBeenCalledWith(
			'team-new',
			expect.objectContaining({
				accountId: 'acct-test-1',
			}),
		);
		expect(payload).toHaveProperty('accessToken');
	});

	it('invite_member generates invite code', async () => {
		const result = await mcp.invokeTool('invite_member', {
			email: 'new.user@test.com',
		});
		const payload = getResultJson(result as any) as Record<string, unknown>;

		expect(services.invite.createInvite).toHaveBeenCalledWith(
			expect.objectContaining({
				teamId: 'team-test-1',
				email: 'new.user@test.com',
			}),
		);
		expect(payload).toHaveProperty('inviteCode');
	});

	it('email verification tools call service methods', async () => {
		const start = await mcp.invokeTool('start_email_verification', {
			email: 'owner@test.com',
		});
		const startPayload = getResultJson(start as any) as Record<string, unknown>;
		expect(startPayload).toHaveProperty('challengeId');

		const verify = await mcp.invokeTool('verify_email_otp', {
			challengeId: '00000000-0000-0000-0000-000000000102',
			otp: '123456',
		});
		const verifyPayload = getResultJson(verify as any) as Record<string, unknown>;
		expect(verifyPayload.verified).toBe(true);
	});
});
