import type { ErrorHandler } from 'hono';
import { logger } from '../../infra/logger.js';

export const errorHandler: ErrorHandler = (err, c) => {
	logger.error('Unhandled error', {
		path: c.req.path,
		method: c.req.method,
		error: err.message,
		stack: err.stack,
	});

	if (err.message.includes('not found') || err.message.includes('Not found')) {
		return c.json({ error: { code: 'NOT_FOUND', message: err.message } }, 404);
	}

	if (err.message.includes('Validation failed')) {
		return c.json({ error: { code: 'VALIDATION_ERROR', message: err.message } }, 400);
	}

	if (err.message.includes('Invalid') || err.message.includes('invalid')) {
		return c.json({ error: { code: 'VALIDATION_ERROR', message: err.message } }, 400);
	}

	if (
		err.message.includes('Permission denied') ||
		err.message.includes('FORBIDDEN') ||
		err.message.includes('Forbidden')
	) {
		return c.json({ error: { code: 'FORBIDDEN', message: err.message } }, 403);
	}

	return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } }, 500);
};
