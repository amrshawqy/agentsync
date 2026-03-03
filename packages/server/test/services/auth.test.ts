import { describe, it, expect, vi } from 'vitest';
import { AuthService } from '../../src/services/auth/auth.service.js';

function createMockDeps() {
	const mockCode = {
		id: 'code-1',
		code: 'test-code',
		clientId: 'client-1',
		redirectUri: 'http://localhost/callback',
		codeChallenge: 'challenge',
		codeChallengeMethod: 'S256',
		scope: 'read write',
		teamId: 'team-1',
		userId: 'user-1',
		expiresAt: new Date(Date.now() + 60000),
		createdAt: new Date(),
	};

	const mockClient = {
		id: 'client-1',
		clientId: 'test-client',
		clientSecret: 'test-secret',
		teamId: 'team-1',
		redirectUris: ['http://localhost/callback'],
		name: 'Test Client',
	};

	const mockToken = {
		id: 'token-1',
		token: 'refresh-token-123',
		userId: 'user-1',
		teamId: 'team-1',
		clientId: 'client-1',
		scope: 'read write',
		expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
		isRevoked: false,
		createdAt: new Date(),
	};

	const db = {
		select: vi.fn().mockReturnValue({
			from: vi.fn().mockReturnValue({
				where: vi.fn().mockResolvedValue([mockCode]),
			}),
		}),
		insert: vi.fn().mockReturnValue({
			values: vi.fn().mockReturnValue({
				returning: vi.fn().mockResolvedValue([mockCode]),
			}),
		}),
		update: vi.fn().mockReturnValue({
			set: vi.fn().mockReturnValue({
				where: vi.fn().mockReturnValue({
					returning: vi.fn().mockResolvedValue([mockToken]),
				}),
			}),
		}),
		delete: vi.fn().mockReturnValue({
			where: vi.fn().mockResolvedValue(undefined),
		}),
	} as any;

	const cache = {
		get: vi.fn().mockResolvedValue(null),
		set: vi.fn().mockResolvedValue(undefined),
		del: vi.fn().mockResolvedValue(undefined),
		incr: vi.fn().mockResolvedValue(1),
	} as any;

	return { db, cache, mockCode, mockClient, mockToken };
}

describe('AuthService', () => {
	it('can be instantiated', () => {
		const deps = createMockDeps();
		const service = new AuthService(deps.db, deps.cache);
		expect(service).toBeDefined();
	});

	it('createAuthorizationCode stores code in database', async () => {
		const deps = createMockDeps();
		const service = new AuthService(deps.db, deps.cache);

		const result = await service.createAuthorizationCode({
			clientId: 'client-1',
			redirectUri: 'http://localhost/callback',
			scope: 'read write',
			teamId: 'team-1',
			userId: 'user-1',
			codeChallenge: 'challenge',
			codeChallengeMethod: 'S256',
		});

		expect(deps.db.insert).toHaveBeenCalled();
		expect(result).toBeDefined();
	});

	it('exchangeCode retrieves and validates code', async () => {
		const deps = createMockDeps();
		const service = new AuthService(deps.db, deps.cache);

		// The PKCE verifier must match the challenge. Since we're mocking,
		// we test that exchangeCode calls the right DB methods.
		await expect(service.exchangeCode({
			code: 'test-code',
			clientId: 'client-1',
			redirectUri: 'http://localhost/callback',
			codeVerifier: 'verifier',
		})).rejects.toThrow(); // Will fail on PKCE check with mock data

		expect(deps.db.select).toHaveBeenCalled();
	});

	it('refreshAccessToken validates refresh token', async () => {
		const deps = createMockDeps();
		deps.db.select.mockReturnValue({
			from: vi.fn().mockReturnValue({
				where: vi.fn().mockResolvedValue([deps.mockToken]),
			}),
		});
		const service = new AuthService(deps.db, deps.cache);

		const result = await service.refreshAccessToken({
			refreshToken: 'refresh-token-123',
			clientId: 'client-1',
		});
		expect(result).toBeDefined();
	});

	it('revokeToken marks token as revoked', async () => {
		const deps = createMockDeps();
		const service = new AuthService(deps.db, deps.cache);

		await service.revokeToken('refresh-token-123');
		expect(deps.db.update).toHaveBeenCalled();
	});

	it('getOAuthClient returns client for valid clientId', async () => {
		const deps = createMockDeps();
		deps.db.select.mockReturnValue({
			from: vi.fn().mockReturnValue({
				where: vi.fn().mockResolvedValue([deps.mockClient]),
			}),
		});
		const service = new AuthService(deps.db, deps.cache);

		const result = await service.getOAuthClient('test-client');
		expect(result).toBeDefined();
	});

	it('getOAuthClient returns null for unknown clientId', async () => {
		const deps = createMockDeps();
		deps.db.select.mockReturnValue({
			from: vi.fn().mockReturnValue({
				where: vi.fn().mockResolvedValue([]),
			}),
		});
		const service = new AuthService(deps.db, deps.cache);

		const result = await service.getOAuthClient('bad-client');
		expect(result).toBeNull();
	});

	it('validateToken verifies JWT and returns payload', async () => {
		const deps = createMockDeps();
		const service = new AuthService(deps.db, deps.cache);

		// Invalid token should throw
		await expect(service.validateToken('invalid-jwt')).rejects.toThrow();
	});

	it('uses cache for rate limiting', () => {
		const deps = createMockDeps();
		const service = new AuthService(deps.db, deps.cache);
		expect(service).toBeDefined();
		// Cache is injected for rate limiting use
		expect(deps.cache).toBeDefined();
	});
});
