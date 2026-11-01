import { getRedis } from './redis';

/**
 * Small read-through cache. Uses Redis when available and an in-process map otherwise.
 * Keys are namespaced per company so a write can invalidate a whole tenant cheaply
 * by bumping its version number.
 */
const memory = new Map<string, { value: string; expiresAt: number }>();
const versions = new Map<string, number>();

async function getVersion(companyId: string): Promise<number> {
  const redis = getRedis();
  if (redis) return Number((await redis.get(`cache:v:${companyId}`)) ?? 0);
  return versions.get(companyId) ?? 0;
}

export async function cached<T>(companyId: string, key: string, ttlSeconds: number, load: () => Promise<T>): Promise<T> {
  const version = await getVersion(companyId);
  const fullKey = `cache:${companyId}:${version}:${key}`;
  const redis = getRedis();

  if (redis) {
    const hit = await redis.get(fullKey);
    if (hit) return JSON.parse(hit) as T;
    const value = await load();
    await redis.set(fullKey, JSON.stringify(value), 'EX', ttlSeconds);
    return value;
  }

  const hit = memory.get(fullKey);
  if (hit && hit.expiresAt > Date.now()) return JSON.parse(hit.value) as T;
  const value = await load();
  memory.set(fullKey, { value: JSON.stringify(value), expiresAt: Date.now() + ttlSeconds * 1000 });
  if (memory.size > 500) {
    for (const [k, v] of memory) if (v.expiresAt < Date.now()) memory.delete(k);
  }
  return value;
}

export async function invalidateCompanyCache(companyId: string) {
  const redis = getRedis();
  if (redis) {
    await redis.incr(`cache:v:${companyId}`);
    return;
  }
  versions.set(companyId, (versions.get(companyId) ?? 0) + 1);
}
