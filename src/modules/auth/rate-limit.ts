import { createHmac, randomInt } from "node:crypto";
import { isIP } from "node:net";
import { Prisma } from "@/generated/prisma/client";
import { AppError } from "@/lib/api";
import { getEnv } from "@/lib/env";
import { log } from "@/lib/log";
import { getPrisma } from "@/lib/prisma";

type RequestHeaders = Headers | Record<string, string | string[] | undefined>;
type Limits = {
  global: number;
  ip: number;
  identity: number;
  seconds?: number;
  failOpen?: boolean;
  globalShards?: number;
};

export async function limitAttempt(
  scope: string,
  headers: RequestHeaders,
  identity?: string,
  limits: Limits = { global: 300, ip: 40, identity: 8 },
) {
  const env = getEnv();
  const header =
    process.env.VERCEL === "1"
      ? "x-vercel-forwarded-for"
      : env.AUTH_TRUSTED_IP_HEADER;
  const rawIp =
    header &&
    (headers instanceof Headers ? headers.get(header) : headers[header]);
  const ip = typeof rawIp === "string" && isIP(rawIp) ? rawIp : undefined;
  const seconds = limits.seconds ?? 900;
  const shards = limits.globalShards ?? 1;
  const shard = randomInt(shards);
  const globalCap =
    Math.floor(limits.global / shards) + Number(shard < limits.global % shards);
  const keys = [
    { subject: shards === 1 ? "global" : `global:${shard}`, limit: globalCap },
    ...(ip ? [{ subject: `ip:${ip}`, limit: limits.ip }] : []),
    ...(identity
      ? [{ subject: `identity:${identity}`, limit: limits.identity }]
      : []),
  ].map(({ subject, limit }) => ({
    key: createHmac("sha256", env.AUTH_SECRET)
      .update(`${scope}:${subject}`)
      .digest("hex"),
    limit,
  }));
  const values = Prisma.join(
    keys.map(({ key, limit }) => Prisma.sql`(${key}::text,${limit}::int)`),
  );
  let result;
  try {
    [result] = await getPrisma().$queryRaw<{ retry: number | null }[]>`
      WITH limits(key, maximum) AS (VALUES ${values}),
      counted AS (
        INSERT INTO "RateLimit" (key, count, "expiresAt")
        SELECT key, 1, CURRENT_TIMESTAMP + ${seconds}::int * interval '1 second'
        FROM limits ORDER BY key
        ON CONFLICT (key) DO UPDATE SET
          count = CASE WHEN "RateLimit"."expiresAt" <= CURRENT_TIMESTAMP THEN 1
                       ELSE LEAST("RateLimit".count, (SELECT maximum FROM limits WHERE key = "RateLimit".key)) + 1 END,
          "expiresAt" = CASE WHEN "RateLimit"."expiresAt" <= CURRENT_TIMESTAMP THEN EXCLUDED."expiresAt"
                             ELSE "RateLimit"."expiresAt" END
        RETURNING key, count, "expiresAt"
      )
      SELECT MAX(GREATEST(1, CEIL(EXTRACT(EPOCH FROM (counted."expiresAt" - CURRENT_TIMESTAMP)))::int)) AS retry
      FROM counted JOIN limits USING (key) WHERE counted.count > limits.maximum
    `;
  } catch {
    log("error", "rate_limit.unavailable", { code: "RATE_STORE_UNAVAILABLE" });
    if (limits.failOpen) return;
    throw new AppError(
      503,
      "RATE_STORE_UNAVAILABLE",
      "Please try again shortly.",
    );
  }
  if (result?.retry)
    throw new AppError(
      429,
      "RATE_LIMITED",
      "Too many attempts. Please try again later.",
      result.retry,
    );
}
