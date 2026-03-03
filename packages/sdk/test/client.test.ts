import { describe, expect, it, vi } from 'vitest';
import { AgentSyncClient } from '../src/client.js';

describe('AgentSyncClient', () => {
	it('does not send auth header for health()', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ status: 'ok' }),
		});
		vi.stubGlobal('fetch', fetchMock);

		const client = new AgentSyncClient({
			serverUrl: 'https://api.example.com',
			accessToken: 'token-123',
		});

		await client.health();

		expect(fetchMock).toHaveBeenCalledWith(
			'https://api.example.com/health',
			expect.objectContaining({
				method: 'GET',
				headers: {},
			}),
		);

		vi.unstubAllGlobals();
	});

	it('sends auth header for authenticated requests', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ success: true, data: [] }),
		});
		vi.stubGlobal('fetch', fetchMock);

		const client = new AgentSyncClient({
			serverUrl: 'https://api.example.com',
			accessToken: 'token-xyz',
		});

		await client.workspaces.list();

		expect(fetchMock).toHaveBeenCalledWith(
			'https://api.example.com/v1/workspaces',
			expect.objectContaining({
				method: 'GET',
				headers: expect.objectContaining({
					Authorization: 'Bearer token-xyz',
				}),
			}),
		);

		vi.unstubAllGlobals();
	});
});
