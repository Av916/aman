import { randomUUID } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { AppError } from "@/lib/api";
import { recordJob } from "@/lib/metrics";
import { log } from "@/lib/log";
import { bookingSettings } from "@/modules/bookings/settings";
import { extendAvailability } from "@/modules/availability/service";
import { cleanOrphanImages } from "@/modules/media/service";
import {
  expireBookings,
  processOutbox,
  reconcilePayments,
  remindBookings,
} from "@/modules/jobs/service";

async function cleanup() {
  const db = getPrisma();
  // Table and column names are fixed at each call site.
  const prune = (table: string, column: string, before: Date) =>
    db.$executeRaw(
      Prisma.sql`DELETE FROM ${Prisma.raw(table)} WHERE ctid IN
      (SELECT ctid FROM ${Prisma.raw(table)} WHERE ${Prisma.raw(column)} < ${before} ORDER BY ${Prisma.raw(column)} LIMIT 1000 FOR UPDATE SKIP LOCKED)`,
    );
  const now = new Date();
  const retention = new Date(+now - 30 * 86400_000);
  const counts = await Promise.all([
    prune('"VerificationToken"', '"expires"', now),
    prune('"PasswordResetToken"', '"expiresAt"', now),
    prune('"CheckInToken"', '"expiresAt"', retention),
    prune('"StaffInvitation"', '"expiresAt"', retention),
    prune('"RateLimit"', '"expiresAt"', now),
    prune('"IdempotencyRecord"', '"expiresAt"', now),
    prune('"JobRun"', '"startedAt"', retention),
  ]);
  const releasedCoupons = await db.$executeRaw`
    UPDATE "CouponRedemption" SET status = 'RELEASED' WHERE id IN (
      SELECT r.id FROM "CouponRedemption" r JOIN "Booking" b ON b.id = r."bookingId"
      WHERE r.status = 'RESERVED' AND r."expiresAt" <= now()
        AND b.status IN ('EXPIRED', 'CANCELLED')
      LIMIT 1000 FOR UPDATE OF r SKIP LOCKED
    )
  `;
  return {
    pruned: counts.reduce((sum, count) => sum + count, 0),
    releasedCoupons,
    cleanedImages: await cleanOrphanImages(),
  };
}

type Work = {
  result: Prisma.InputJsonObject;
  cursor?: string | null;
  failed?: boolean;
};
const jobs = {
  expire: async () => ({ result: await expireBookings(10) }),
  reconcile: async () => {
    if (!bookingSettings().RAZORPAY_KEY_ID)
      return { result: { providerConfigured: false } };
    const result = await reconcilePayments(undefined, 1);
    return { result, failed: result.errors > 0 };
  },
  reminders: async () => ({ result: await remindBookings(15) }),
  outbox: async () => {
    const result = await processOutbox(undefined, 3);
    return { result, failed: result.failed > 0 };
  },
  availability: async (cursor: string | null) => {
    const result = await extendAvailability(cursor ?? undefined, 5);
    return { result, cursor: result.nextCursor };
  },
  cleanup: async () => ({ result: await cleanup() }),
} satisfies Record<string, (cursor: string | null) => Promise<Work>>;

export type JobName = keyof typeof jobs;
export function isJobName(name: string): name is JobName {
  return Object.hasOwn(jobs, name);
}

export async function runJob(name: JobName, injected?: () => Promise<Work>) {
  const db = getPrisma();
  const id = randomUUID();
  const start = performance.now();
  const claimed = await db.$transaction(async (tx) => {
    const [lease] = await tx.$queryRaw<{ cursor: string | null }[]>`
      INSERT INTO "JobLease" (name, token, "expiresAt") VALUES (${name}, ${id}::uuid, now() + interval '5 minutes')
      ON CONFLICT (name) DO UPDATE SET token = EXCLUDED.token, "expiresAt" = EXCLUDED."expiresAt"
      WHERE "JobLease"."expiresAt" <= now()
      RETURNING cursor
    `;
    if (!lease) return null;
    await tx.jobRun.updateMany({
      where: { name, status: "RUNNING" },
      data: {
        status: "INTERRUPTED",
        finishedAt: new Date(),
        errorCode: "LEASE_EXPIRED",
      },
    });
    await tx.jobRun.create({ data: { id, name, status: "RUNNING" } });
    return lease;
  });
  if (!claimed) return { skipped: true };
  async function finish(status: "SUCCEEDED" | "FAILED", work?: Work) {
    const now = new Date();
    await db.$transaction(async (tx) => {
      const changed = await tx.jobLease.updateMany({
        where: { name, token: id },
        data: {
          expiresAt: now,
          ...(work?.cursor !== undefined ? { cursor: work.cursor } : {}),
        },
      });
      if (changed.count)
        await tx.jobRun.updateMany({
          where: { id, status: "RUNNING" },
          data: {
            status,
            finishedAt: now,
            result: work?.result,
            errorCode: status === "FAILED" ? "JOB_WORK_FAILED" : null,
          },
        });
    });
    recordJob(name, status, performance.now() - start);
    log(status === "FAILED" ? "error" : "info", "job.finished", {
      job: name,
      runId: id,
      code: status,
      durationMs: Math.round(performance.now() - start),
    });
  }
  let work: Work;
  try {
    work = await (injected ?? (() => jobs[name](claimed.cursor)))();
  } catch {
    await finish("FAILED");
    throw new AppError(503, "JOB_FAILED", "Scheduled work will be retried.");
  }
  await finish(work.failed ? "FAILED" : "SUCCEEDED", work);
  return { skipped: false, ...work.result };
}
