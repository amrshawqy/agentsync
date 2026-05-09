import { Hono } from 'hono';
import type { ServiceContainer } from '../../services/index.js';
import { authMiddleware } from '../middleware/auth.js';

export function createUploadRoutes(services: ServiceContainer): Hono {
	const app = new Hono();

	app.use('/*', authMiddleware);

	// Generate presigned upload URL
	app.post('/presign', async (c) => {
		if (!services.storage) {
			return c.json(
				{ error: { code: 'STORAGE_DISABLED', message: 'File storage is not configured' } },
				501,
			);
		}

		const body = await c.req.json();
		const { fileName, mimeType } = body;

		if (!fileName || !mimeType) {
			return c.json(
				{ error: { code: 'BAD_REQUEST', message: 'fileName and mimeType are required' } },
				400,
			);
		}

		const teamId = c.get('teamId');
		const result = await services.storage.generateUploadUrl(teamId, fileName, mimeType);

		return c.json({ success: true, data: result });
	});

	// Generate presigned download URL
	app.get('/download', async (c) => {
		if (!services.storage) {
			return c.json(
				{ error: { code: 'STORAGE_DISABLED', message: 'File storage is not configured' } },
				501,
			);
		}

		const path = c.req.query('path');
		if (!path) {
			return c.json(
				{ error: { code: 'BAD_REQUEST', message: 'path query parameter is required' } },
				400,
			);
		}

		const downloadUrl = await services.storage.generateDownloadUrl(path);

		return c.json({ success: true, data: { downloadUrl } });
	});

	return app;
}
