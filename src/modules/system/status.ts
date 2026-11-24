import { getPrisma } from "@/lib/prisma";

export async function systemStatus() {
  const db = getPrisma();
  const stale = new Date(Date.now() - 15 * 60_000);
  const [jobs, outbox, webhooks, refundExceptions, orderExceptions] =
    await Promise.all([
      db.jobRun.findMany({ orderBy: { startedAt: "desc" }, take: 30 }),
      db.outboxEvent.groupBy({ by: ["status"], _count: true }),
      db.paymentWebhookEvent.count({ where: { processingStatus: "FAILED" } }),
      db.refund.findMany({
        where: {
          OR: [
            { status: "FAILED" },
            {
              status: { in: ["PENDING", "PROCESSING"] },
              createdAt: { lt: stale },
            },
          ],
        },
        select: {
          id: true,
          bookingId: true,
          status: true,
          amount: true,
          updatedAt: true,
          payment: { select: { provider: true } },
        },
        take: 30,
        orderBy: { updatedAt: "desc" },
      }),
      db.paymentOrder.findMany({
        where: {
          status: { in: ["CREATED", "PENDING", "AUTHORIZED"] },
          createdAt: { lt: stale },
        },
        select: { id: true, bookingId: true, updatedAt: true, status: true },
        orderBy: { updatedAt: "desc" },
        take: 30,
      }),
    ]);
  const [failedOutbox, audit, unappliedCaptures] = await Promise.all([
    db.outboxEvent.findMany({
      where: { status: "FAILED" },
      orderBy: { nextAttemptAt: "desc" },
      take: 30,
      select: {
        id: true,
        eventType: true,
        attempts: true,
        nextAttemptAt: true,
      },
    }),
    db.auditLog.findMany({
      where: { entityType: { in: ["JobRun", "OutboxEvent", "PaymentOrder"] } },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        createdAt: true,
      },
    }),
    db.$queryRaw<{ id: string; bookingId: string; amount: number }[]>`
      SELECT p.id, p."bookingId", p.amount FROM "Payment" p JOIN "Booking" b ON p."bookingId" = b.id
      WHERE p."paidAt" IS NOT NULL AND p.provider = 'RAZORPAY'
        AND b."confirmedPaymentId" IS DISTINCT FROM p.id
        AND NOT EXISTS(SELECT 1 FROM "Refund" r WHERE r."paymentId" = p.id)
      ORDER BY p."paidAt" DESC LIMIT 30
    `,
  ]);
  return {
    jobs,
    outbox,
    webhooks,
    refundExceptions,
    orderExceptions,
    failedOutbox,
    audit,
    unappliedCaptures,
  };
}
