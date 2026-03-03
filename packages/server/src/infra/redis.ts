import Redis from 'ioredis';
import { getConfig } from '../config.js';
import { logger } from './logger.js';

let _redis: Redis | null = null;

export function getRedis(): Redis {
	if (!_redis) {
		const config = getConfig();
		_redis = new Redis(config.REDIS_URL, {
			maxRetriesPerRequest: 3,
			lazyConnect: true,
		});

		_redis.on('connect', () => logger.info('Redis connected'));
		_redis.on('error', (err) => logger.error('Redis error', { error: String(err) }));
	}
	return _redis;
}

export async function closeRedis(): Promise<void> {
	if (_redis) {
		await _redis.quit();
		_redis = null;
	}
}
