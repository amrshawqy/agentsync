import type Redis from 'ioredis';
import { logger } from '../../infra/logger.js';

export class CacheService {
	constructor(private redis: Redis) {}

	async get<T>(key: string): Promise<T | null> {
		const raw = await this.redis.get(key);
		if (!raw) return null;
		try {
			return JSON.parse(raw) as T;
		} catch {
			return null;
		}
	}

	async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
		const serialized = JSON.stringify(value);
		if (ttlSeconds) {
			await this.redis.setex(key, ttlSeconds, serialized);
		} else {
			await this.redis.set(key, serialized);
		}
	}

	async del(key: string): Promise<void> {
		await this.redis.del(key);
	}

	async delPattern(pattern: string): Promise<void> {
		let cursor = '0';
		do {
			const [nextCursor, keys] = await this.redis.scan(
				cursor,
				'MATCH',
				pattern,
				'COUNT',
				100,
			);
			cursor = nextCursor;
			if (keys.length > 0) {
				await this.redis.del(...keys);
			}
		} while (cursor !== '0');
	}

	async exists(key: string): Promise<boolean> {
		const result = await this.redis.exists(key);
		return result === 1;
	}

	async incr(key: string, ttlSeconds?: number): Promise<number> {
		const val = await this.redis.incr(key);
		if (ttlSeconds && val === 1) {
			await this.redis.expire(key, ttlSeconds);
		}
		return val;
	}
}
