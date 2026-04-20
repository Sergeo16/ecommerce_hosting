/**
 * Rate limit IP + anti brute force (Redis)
 */
import { redis } from './redis';

const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = 100;
const LOGIN_KEY_PREFIX = 'login:';
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_LOCK_MINUTES = 15;

export async function checkRateLimit(ip: string): Promise<{ allowed: boolean; remaining: number }> {
  const key = `ratelimit:${ip}`;
  const current = await redis.incr(key);
  if (current === 1) await redis.pexpire(key, WINDOW_MS);
  const ttl = await redis.pttl(key);
  if (ttl === -1) await redis.pexpire(key, WINDOW_MS);
  return {
    allowed: current <= MAX_REQUESTS,
    remaining: Math.max(0, MAX_REQUESTS - current),
  };
}

export async function recordLoginAttempt(identifier: string): Promise<{ locked: boolean; attemptsLeft: number }> {
  const key = `${LOGIN_KEY_PREFIX}${identifier}`;
  const attempts = await redis.incr(key);
  if (attempts === 1) await redis.expire(key, LOGIN_LOCK_MINUTES * 60);
  const ttl = await redis.ttl(key);
  if (attempts >= LOGIN_MAX_ATTEMPTS) {
    await redis.expire(key, LOGIN_LOCK_MINUTES * 60);
    return { locked: true, attemptsLeft: 0 };
  }
  return { locked: false, attemptsLeft: LOGIN_MAX_ATTEMPTS - attempts };
}

export async function clearLoginAttempts(identifier: string): Promise<void> {
  await redis.del(`${LOGIN_KEY_PREFIX}${identifier}`);
}
