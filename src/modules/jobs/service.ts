import { bookingSettings } from "@/modules/bookings/settings";
import { notify } from "@/modules/notifications/service";
import { z } from "zod";
import { AppError } from "@/lib/api";
import { getEnv } from "@/lib/env";
import { getPrisma } from "@/lib/prisma";
import { expireBooking } from "@/modules/bookings/booking.service";
import {
  lockBooking,
  transaction,
  bookingAudit,
} from "@/modules/bookings/booking.repository";
import { assertTransition } from "@/modules/bookings/booking.state-machine";
import { paymentGateway } from "@/modules/payments/razorpay.provider";
import {
  attachOrder,
  processProviderPayment,
} from "@/modules/payments/payment.service";
import { processWebhook } from "@/modules/payments/webhook.service";
import { sendCompensation } from "@/modules/payments/refund.service";
import type { PaymentGateway } from "@/modules/payments/payment.provider";
import { generateReceipt } from "@/modules/receipts/service";
import { randomUUID } from "node:crypto";
import { link, mkdir, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

const operationalEmail = z.object({
  to: z.email(),
  title: z.string(),
  text: z.string(),
});

export async function expireBookings(size = 25) {
  const db = getPrisma();
  const now = new Date();
  const expired = await db.booking.findMany({
    where: { status: "PENDING_PAYMENT", holdExpiresAt: { lte: now } },
    orderBy: { holdExpiresAt: "asc" },
    take: size,
    select: { id: true },
  });
  for (const { id } of expired) await expireBooking(id);
  const completed = await db.booking.findMany({
    where: { status: "CHECKED_IN", endAt: { lte: now } },
    orderBy: { endAt: "asc" },
    take: size,
    select: { id: true },
  });
  for (const { id } of completed)
    await transaction(async (tx) => {
      const { booking } = await lockBooking(tx, id);
      if (booking.status !== "CHECKED_IN" || booking.endAt > now) return;
      assertTransition(booking.status, "COMPLETED");
      await tx.booking.update({
        where: { id },
        data: { status: "COMPLETED", completedAt: now },
      });
      await bookingAudit(tx, booking, "BOOKING_COMPLETED");
    });
  return { scannedExpired: expired.length, scannedCompleted: completed.length };
}

export async function remindBookings(size = 100) {
  const db = getPrisma();
  const now = new Date();
  let scanned = 0;
  for (const minutes of bookingSettings().BOOKING_REMINDER_MINUTES) {
    const candidates = await db.$queryRaw<{ id: string }[]>`
      SELECT b.id FROM "Booking" b
      WHERE b.status = 'CONFIRMED'
        AND (b."customerId" IS NOT NULL OR b."customerEmail" IS NOT NULL)
        AND b."startAt" <= ${new Date(+now + minutes * 60_000)} AND b."startAt" > ${now}
        AND b."confirmedAt" <= b."startAt" - ${minutes}::int * interval '1 minute'
        AND NOT EXISTS (SELECT 1 FROM "OutboxEvent" o WHERE o."dedupeKey" = 'email:' || b.id::text || ':BOOKING_REMINDER:' || ${String(minutes)})
      ORDER BY b."startAt", b.id LIMIT ${size}
    `;
    for (const { id } of candidates)
      await transaction(async (tx) => {
        const { booking } = await lockBooking(tx, id);
        if (booking.status === "CONFIRMED" && booking.startAt > new Date())
          await notify(tx, booking, "BOOKING_REMINDER", String(minutes));
      });
    scanned += candidates.length;
  }
  return { scanned };
}

export async function reconcilePayments(injected?: PaymentGateway, size = 5) {
  const db = getPrisma();
  const now = new Date();
  const check = { lte: now };
  const gateway = injected ?? paymentGateway();
  const events = await db.paymentWebhookEvent.findMany({
    where: {
      processingStatus: { in: ["PENDING", "PROCESSING"] },
      nextAttemptAt: check,
    },
    orderBy: { nextAttemptAt: "asc" },
    select: { id: true },
    take: size,
  });
  const orders = await db.paymentOrder.findMany({
    where: {
      nextCheckAt: check,
      createdAt: { gte: new Date(+now - 7 * 86400_000) },
    },
    orderBy: { nextCheckAt: "asc" },
    take: size,
  });
  let errors = 0;
  for (let order of orders) {
    const claimed = await db.paymentOrder.updateMany({
      where: { id: order.id, nextCheckAt: check },
      data: { nextCheckAt: new Date(+now + 60_000) },
    });
    if (!claimed.count) continue;
    try {
      if (!order.providerOrderId) {
        const candidate = await gateway.findOrder(order.providerReceipt);
        if (candidate) order = await attachOrder(order, candidate);
      }
      if (order.providerOrderId)
        for (const payment of await gateway.orderPayments(
          order.providerOrderId,
        ))
          await processProviderPayment(order, payment);
      await db.paymentOrder.update({
        where: { id: order.id },
        data: {
          nextCheckAt: new Date(
            Date.now() + (order.status === "CAPTURED" ? 15 : 2) * 60_000,
          ),
        },
      });
    } catch {
      errors++;
    }
  }
  for (const event of events)
    if (!(await processWebhook(event.id, gateway))) errors++;
  const refunds = await db.refund.findMany({
    where: {
      status: "PROCESSING",
      payment: { provider: "RAZORPAY" },
      updatedAt: { lte: new Date(+now - 60_000) },
    },
    select: { id: true },
    orderBy: { updatedAt: "asc" },
    take: size,
  });
  for (const refund of refunds) {
    const claimed = await db.refund.updateMany({
      where: {
        id: refund.id,
        status: "PROCESSING",
        updatedAt: { lte: new Date(+now - 60_000) },
      },
      data: { updatedAt: now },
    });
    if (!claimed.count) continue;
    try {
      await sendCompensation(refund.id, gateway);
    } catch {
      errors++;
    }
  }
  return {
    orders: orders.length,
    events: events.length,
    refunds: refunds.length,
    errors,
  };
}

async function sendBookingEmail(id: string, key: string, snapshot: unknown) {
  const notification = await getPrisma().notification.findUniqueOrThrow({
    where: { id },
    include: { booking: true, user: { select: { email: true } } },
  });
  const booking = notification.booking;
  const customerName =
    snapshot &&
    typeof snapshot === "object" &&
    "customerName" in snapshot &&
    typeof snapshot.customerName === "string"
      ? snapshot.customerName
      : booking.customerName;
  const env = getEnv();
  const time = new Intl.DateTimeFormat("en-IN", {
    timeZone: booking.timezone,
    dateStyle: "medium",
    timeStyle: "short",
  });
  const text = [
    `PitchMate | ${notification.title}`,
    "",
    `Hello ${customerName},`,
    notification.message,
    "",
    `${booking.venueName} · ${booking.pitchName}`,
    `${time.format(booking.startAt)} to ${time.format(booking.endAt)} (${booking.timezone})`,
    ...(notification.type === "BOOKING_CONFIRMED" && booking.confirmedPaymentId
      ? [`Total paid: INR ${(booking.totalAmount / 100).toFixed(2)}`]
      : []),
    new URL(`/bookings/${booking.id}/confirmation`, env.APP_URL).href,
  ].join("\n");
  await deliverEmail(
    id,
    key,
    notification.user.email,
    notification.title,
    text,
  );
}

async function deliverEmail(
  id: string,
  key: string,
  to: string,
  title: string,
  text: string,
) {
  const env = getEnv();
  const subject = `PitchMate · ${title}`;
  if (!env.EMAIL_PROVIDER_API_KEY) {
    const directory = process.env.PITCHMATE_MAIL_DIR ?? ".pitchmate-mail";
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const target = join(directory, `notification-${id}.json`);
    const temporary = join(directory, `.${randomUUID()}.pending`);
    try {
      await writeFile(temporary, JSON.stringify({ to, subject, text }), {
        flag: "wx",
        mode: 0o600,
      });
      await link(temporary, target);
    } catch (error) {
      if (!(
        error instanceof Error &&
        "code" in error &&
        error.code === "EEXIST"
      ))
        throw error;
    } finally {
      await unlink(temporary).catch(() => {});
    }
    return;
  }
  const reply = await fetch("https://api.resend.com/emails", {
    method: "POST",
    signal: AbortSignal.timeout(6000),
    headers: {
      Authorization: `Bearer ${env.EMAIL_PROVIDER_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": key,
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [to],
      subject,
      text,
    }),
  });
  if (!reply.ok)
    throw new AppError(503, "DELIVERY_FAILED", "Email provider unavailable.");
}

export async function processOutbox(injected?: PaymentGateway, size = 10) {
  const db = getPrisma();
  let processed = 0;
  let failed = 0;
  for (let index = 0; index < size; index++) {
    const [claimed] = await db.$queryRaw<{ id: string }[]>`
      UPDATE "OutboxEvent" SET status = 'PROCESSING', attempts = attempts + 1, "nextAttemptAt" = now() + interval '90 seconds'
      WHERE id = (SELECT id FROM "OutboxEvent" WHERE status IN ('PENDING','PROCESSING') AND "nextAttemptAt" <= now()
        ORDER BY "nextAttemptAt", id LIMIT 1 FOR UPDATE SKIP LOCKED)
      RETURNING id
    `;
    if (!claimed) break;
    const event = await db.outboxEvent.findUniqueOrThrow({
      where: { id: claimed.id },
    });
    const where = { id: event.id, attempts: event.attempts };
    try {
      if (event.eventType === "BOOKING_EMAIL")
        await sendBookingEmail(
          event.aggregateId,
          event.dedupeKey,
          event.payload,
        );
      if (event.eventType === "OPERATIONAL_EMAIL") {
        const { to, title, text } = operationalEmail.parse(event.payload);
        await deliverEmail(event.id, event.dedupeKey, to, title, text);
      }
      if (event.eventType === "BOOKING_RECEIPT")
        await generateReceipt(event.aggregateId);
      if (event.eventType === "COMPENSATING_REFUND")
        await sendCompensation(event.aggregateId, injected);
      await db.outboxEvent.updateMany({
        where,
        data: {
          status: "PROCESSED",
          processedAt: new Date(),
          lastError: null,
          ...(event.eventType === "OPERATIONAL_EMAIL" ? { payload: {} } : {}),
        },
      });
      processed++;
    } catch {
      await db.outboxEvent.updateMany({
        where,
        data: {
          status: event.attempts >= 10 ? "FAILED" : "PENDING",
          lastError: "Background delivery failed.",
          nextAttemptAt: new Date(
            Date.now() + Math.min(3600, 15 * 2 ** event.attempts) * 1000,
          ),
        },
      });
      failed++;
    }
  }
  return { processed, failed };
}
