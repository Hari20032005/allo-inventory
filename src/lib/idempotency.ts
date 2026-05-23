import { redis } from "./redis";

const TTL_SECONDS = 86400; // 24 hours — standard idempotency window

type StoredResponse = {
  status: number;
  body: unknown;
};

export async function getIdempotentResponse(
  key: string
): Promise<StoredResponse | null> {
  const raw = await redis.get<StoredResponse>(`idempotency:${key}`);
  return raw ?? null;
}

export async function setIdempotentResponse(
  key: string,
  status: number,
  body: unknown
): Promise<void> {
  await redis.set(`idempotency:${key}`, { status, body }, { ex: TTL_SECONDS });
}
