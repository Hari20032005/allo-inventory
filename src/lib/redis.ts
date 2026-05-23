import { Redis } from "@upstash/redis";

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const LOCK_TTL_MS = 5000;

export async function acquireLock(key: string): Promise<string | null> {
  const lockKey = `lock:${key}`;
  const lockValue = crypto.randomUUID();
  // SET NX PX — only set if not exists, expire after TTL
  const result = await redis.set(lockKey, lockValue, {
    nx: true,
    px: LOCK_TTL_MS,
  });
  return result === "OK" ? lockValue : null;
}

export async function releaseLock(key: string, value: string): Promise<void> {
  const lockKey = `lock:${key}`;
  const current = await redis.get(lockKey);
  // Only delete if we own the lock
  if (current === value) {
    await redis.del(lockKey);
  }
}
