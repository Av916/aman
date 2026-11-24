import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { AppError } from "@/lib/api";
import { getEnv } from "@/lib/env";
import { getPrisma } from "@/lib/prisma";

type RequestHeaders = Headers | Record<string, string | string[] | undefined>;

export async function limitAttempt(
  scope: string,
  headers: RequestHeaders,
  identity?: string,
) {
  const env = getEnv();
  const header = env.AUTH_TRUSTED_IP_HEADER;
  const rawIp =
    header &&
    (headers instanceof Headers ? headers.get(header) : headers[header]);
  const ip = typeof rawIp === "string" && isIP(rawIp) ? rawIp : undefined;
  const keys = [
    { subject: "global", limit: 300 },
    ...(ip ? [{ subject: `ip:${ip}`, limit: 40 }] : []),
    ...(identity ? [{ subject: `identity:${identity}`, limit: 8 }] : []),
  ];

  for (const { subject, limit } of keys) {
    const key = createHmac("sha256", env.AUTH_SECRET)
      .update(`${scope}:${subject}`)
      .digest("hex");
    const [bucket] = await getPrisma().$queryRaw<{ count: number }[]>`
      INSERT INTO "RateLimit" ("key", "count", "expiresAt")
      VALUES (${key}, 1, CURRENT_TIMESTAMP + interval '15 minutes')
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE WHEN "RateLimit"."expiresAt" <= CURRENT_TIMESTAMP THEN 1
                       ELSE LEAST("RateLimit"."count", ${limit}::integer) + 1 END,
        "expiresAt" = CASE WHEN "RateLimit"."expiresAt" <= CURRENT_TIMESTAMP
                           THEN EXCLUDED."expiresAt" ELSE "RateLimit"."expiresAt" END
      RETURNING "count"
    `;
    if (bucket.count > limit) {
      throw new AppError(
        429,
        "RATE_LIMITED",
        "Too many attempts. Please try again in 15 minutes.",
      );
    }
  }
}
