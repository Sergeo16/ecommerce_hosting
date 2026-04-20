/**
 * Client Redis pour BullMQ, cache, rate limit
 */
import Redis from 'ioredis';

const url = process.env.REDIS_URL;

export type RedisLike = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<'OK' | string>;
  del(key: string): Promise<number>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  pexpire(key: string, ms: number): Promise<number>;
  pttl(key: string): Promise<number>;
  ttl(key: string): Promise<number>;
};

type MemEntry = { value: string; expiresAtMs: number | null };

class MemoryRedis implements RedisLike {
  private store = new Map<string, MemEntry>();

  private now() {
    return Date.now();
  }

  private gc(key: string) {
    const e = this.store.get(key);
    if (!e) return;
    if (e.expiresAtMs != null && e.expiresAtMs <= this.now()) this.store.delete(key);
  }

  async get(key: string): Promise<string | null> {
    this.gc(key);
    return this.store.get(key)?.value ?? null;
  }

  async set(key: string, value: string): Promise<'OK'> {
    this.store.set(key, { value, expiresAtMs: this.store.get(key)?.expiresAtMs ?? null });
    return 'OK';
  }

  async del(key: string): Promise<number> {
    const existed = this.store.delete(key);
    return existed ? 1 : 0;
  }

  async incr(key: string): Promise<number> {
    this.gc(key);
    const cur = Number(this.store.get(key)?.value ?? 0);
    const next = cur + 1;
    const expiresAtMs = this.store.get(key)?.expiresAtMs ?? null;
    this.store.set(key, { value: String(next), expiresAtMs });
    return next;
  }

  async expire(key: string, seconds: number): Promise<number> {
    this.gc(key);
    if (!this.store.has(key)) return 0;
    const e = this.store.get(key)!;
    e.expiresAtMs = this.now() + seconds * 1000;
    this.store.set(key, e);
    return 1;
  }

  async pexpire(key: string, ms: number): Promise<number> {
    this.gc(key);
    if (!this.store.has(key)) return 0;
    const e = this.store.get(key)!;
    e.expiresAtMs = this.now() + ms;
    this.store.set(key, e);
    return 1;
  }

  async ttl(key: string): Promise<number> {
    this.gc(key);
    const e = this.store.get(key);
    if (!e) return -2;
    if (e.expiresAtMs == null) return -1;
    return Math.max(0, Math.ceil((e.expiresAtMs - this.now()) / 1000));
  }

  async pttl(key: string): Promise<number> {
    this.gc(key);
    const e = this.store.get(key);
    if (!e) return -2;
    if (e.expiresAtMs == null) return -1;
    return Math.max(0, e.expiresAtMs - this.now());
  }
}

const globalForRedis = globalThis as unknown as { redis: Redis };

export const redis: RedisLike = url
  ? (globalForRedis.redis ??
      new Redis(url, {
        maxRetriesPerRequest: 3,
        retryStrategy(times) {
          return Math.min(times * 100, 3000);
        },
      }))
  : new MemoryRedis();

if (url && process.env.NODE_ENV !== 'production') globalForRedis.redis = redis as Redis;

export function getRedisConnection(): Redis {
  if (!url) {
    throw new Error('REDIS_URL manquant: BullMQ nécessite Redis. Utilisez QUEUE_MODE=inline sur Vercel.');
  }
  return new Redis(url, { maxRetriesPerRequest: 3 });
}
