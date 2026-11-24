import { z } from "zod";
import { AppError } from "@/lib/api";
import { getPrisma } from "@/lib/prisma";
import {
  bookingAudit,
  transaction,
} from "@/modules/bookings/booking.repository";
import { lockOperationalBooking } from "@/modules/operations/bookings";
import { venueScope, type Actor } from "@/modules/permissions/operations";
import { enqueue } from "@/modules/notifications/service";
import { reserveRefund, postProcessedRefund } from "./refunds";
import type { OperationQuery } from "@/modules/operations/queries";

export const adjustmentInput = z.strictObject({
  amount: z.number().int().positive().max(2147483647),
  reason: z.string().trim().min(5).max(300),
});

export function manualRefund(
  actor: Actor,
  id: string,
  input: z.output<typeof adjustmentInput>,
  key: string,
) {
  return transaction(async (tx) => {
    const { booking } = await lockOperationalBooking(tx, actor, id, "refund");
    if (booking.status === "RESCHEDULED")
      throw new AppError(
        409,
        "PAYMENT_TRANSFERRED",
        "Manage allocated money on the replacement booking.",
      );
    const payment = booking.confirmedPaymentId
      ? await tx.payment.findUnique({
          where: { id: booking.confirmedPaymentId },
        })
      : null;
    if (!payment)
      throw new AppError(
        409,
        "NO_PAYMENT",
        "There is no captured payment for this booking.",
      );
    const refund = await reserveRefund(
      tx,
      booking,
      payment,
      `adjustment:${actor.id}:${key}`,
      input.amount,
      input.reason,
    );
    await bookingAudit(
      tx,
      booking,
      "REFUND_RESERVED",
      { refundId: refund.id },
      actor.id,
    );
    return refund;
  });
}

export async function listRefunds(
  actor: Actor,
  query: OperationQuery,
  id?: string,
) {
  const rows = await getPrisma().refund.findMany({
    where: {
      id,
      booking: {
        venue: venueScope(actor, "refund"),
        venueId: query.venueId,
        pitchId: query.pitchId,
      },
    },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    skip: id ? 0 : (query.page - 1) * 25,
    take: id ? 1 : 25,
    include: {
      booking: {
        select: {
          bookingNumber: true,
          customerName: true,
          venueName: true,
          timezone: true,
        },
      },
      payment: {
        select: { amount: true, paymentMethod: true, provider: true },
      },
    },
  });
  if (id && !rows.length)
    throw new AppError(404, "REFUND_NOT_FOUND", "Refund not found.");
  return rows;
}

export function settleOfflineRefund(
  actor: Actor,
  id: string,
  reference: string,
) {
  return transaction(async (tx) => {
    const target = await tx.refund.findFirst({
      where: { id, booking: { venue: venueScope(actor, "refund") } },
      select: { bookingId: true },
    });
    if (!target)
      throw new AppError(404, "REFUND_NOT_FOUND", "Refund not found.");
    const { booking } = await lockOperationalBooking(
      tx,
      actor,
      target.bookingId,
      "refund",
    );
    const refund = await tx.refund.findUniqueOrThrow({
      where: { id },
      include: { payment: true },
    });
    if (refund.status === "PROCESSED") return refund;
    if (refund.payment.provider !== "OFFLINE" || refund.status !== "PENDING")
      throw new AppError(
        409,
        "MANUAL_SETTLEMENT_UNAVAILABLE",
        "This refund cannot be settled offline.",
      );
    const now = new Date();
    const updated = await tx.refund.update({
      where: { id },
      data: { status: "PROCESSED", processedAt: now },
    });
    await bookingAudit(
      tx,
      booking,
      "OFFLINE_REFUND_SETTLED",
      { refundId: id, reference },
      actor.id,
    );
    await postProcessedRefund(tx, booking, updated, now);
    return updated;
  });
}

export function retryRefund(actor: Actor, id: string, reason: string) {
  if (actor.role !== "ADMIN")
    throw new AppError(403, "FORBIDDEN", "Administrator access is required.");
  return transaction(async (tx) => {
    const target = await tx.refund.findUniqueOrThrow({
      where: { id },
      include: { payment: true },
    });
    const { booking } = await lockOperationalBooking(
      tx,
      actor,
      target.bookingId,
      "refund",
    );
    if (target.payment.provider !== "RAZORPAY")
      throw new AppError(
        409,
        "OFFLINE_REFUND",
        "Settle offline refunds through the manual settlement workflow.",
      );
    const current = await tx.refund.findUniqueOrThrow({ where: { id } });
    if (current.status === "PROCESSED") return current;
    const updated = await tx.refund.update({
      where: { id },
      data: { status: current.providerRefundId ? "PROCESSING" : "PENDING" },
    });
    const event = await enqueue(tx, "COMPENSATING_REFUND", id, `refund:${id}`);
    if (event.status !== "PROCESSING")
      await tx.outboxEvent.update({
        where: { id: event.id },
        data: { status: "PENDING", attempts: 0, nextAttemptAt: new Date() },
      });
    await bookingAudit(
      tx,
      booking,
      "REFUND_RETRY_REQUESTED",
      { refundId: id, reason },
      actor.id,
    );
    return updated;
  });
}
