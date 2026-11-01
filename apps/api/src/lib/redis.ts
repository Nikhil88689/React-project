import { Redis } from 'ioredis';
import { env } from '../config/env';
import { logger } from './logger';

let client: Redis | null = null;

/** Returns a shared Redis connection, or null when REDIS_URL is not configured. */
export function getRedis(): Redis | null {
  if (!env.REDIS_URL) return null;
  if (!client) {
    client = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
    client.on('error', (err) => logger.error({ err }, 'Redis connection error'));
  }
  return client;
}

export function createRedisConnection(): Redis {
  if (!env.REDIS_URL) throw new Error('REDIS_URL is not configured');
  return new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
}
