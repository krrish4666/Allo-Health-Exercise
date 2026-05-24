import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";

const IDEMPOTENCY_TTL_SECONDS = 60 * 60 * 24;

export type CachedHttpResponse = {
  status: number;
  body: unknown;
};

export async function withIdempotency(
  request: Request,
  namespace: string,
  handler: () => Promise<CachedHttpResponse>
) {
  const key = request.headers.get("Idempotency-Key");

  if (!key || !redis) {
    const response = await handler();
    return NextResponse.json(response.body, { status: response.status });
  }

  const redisKey = `idempotency:${namespace}:${key}`;
  const cached = await redis.get<CachedHttpResponse>(redisKey);

  if (cached) {
    return NextResponse.json(cached.body, {
      status: cached.status,
      headers: { "Idempotency-Replayed": "true" }
    });
  }

  const response = await handler();
  await redis.set(redisKey, response, { ex: IDEMPOTENCY_TTL_SECONDS });

  return NextResponse.json(response.body, {
    status: response.status,
    headers: { "Idempotency-Replayed": "false" }
  });
}
