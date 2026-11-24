import type {
  Booking,
  Prisma,
  CancellationType,
} from "@/generated/prisma/client";
import { AppError } from "@/lib/api";
import { assertTransition } from "@/modules/bookings/booking.state-machine";
import {
  bookingAudit,
  lockBooking,
  transaction,
} from "@/modules/bookings/booking.repository";
import { refreshPitch } from "@/modules/availability/service";
import { reserveRefund, reservedRefunds } from "@/modules/finance/refunds";
import { notify } from "@/modules/notifications/service";
import {
  requireVenueWrite,
  type Actor,
} from "@/modules/permissions/operations";
import { lockOperationalBooking } from "@/modules/operations/bookings";
import { refundQuote, policyInput } from "./policy";
import { lockVenue } from "@/modules/venues/venue.repository";
import type { z } from "zod";

async function lockCancellation(
  tx: Prisma.TransactionClient,
  actor: Actor,
  id: string,
  operator: boolean,
) {
  return operator
    ? lockOperationalBooking(tx, actor, id, "cancel")
    : lockBooking(tx, id, actor.id);
}

function eligible(status: string, startAt: Date, now: Date, operator: boolean) {
  if (
    !(status === "CONFIRMED" || (operator && status === "PENDING_PAYMENT")) ||
    startAt <= now
  )
    throw new AppError(
      409,
      "CANCELLATION_UNAVAILABLE",
      "This booking can no longer be cancelled.",
    );
}

async function refundableLines(tx: Prisma.TransactionClient, booking: Booking) {
  const allocations = await tx.paymentAllocation.findMany({
    where: { bookingId: booking.id },
    orderBy: { paymentId: "asc" },
  });
  const applied = allocations.length
    ? allocations
    : booking.confirmedPaymentId
      ? [{ paymentId: booking.confirmedPaymentId, amount: booking.totalAmount }]
      : [];
  const lines = [];
  for (const item of applied) {
    const payment = await tx.payment.findUniqueOrThrow({
      where: { id: item.paymentId },
    });
    const available = Math.max(
      0,
      Math.min(
        item.amount,
        payment.amount - (await reservedRefunds(tx, payment.id)),
      ),
    );
    lines.push({
      payment,
      applied: Math.min(item.amount, payment.amount),
      available,
    });
  }
  return lines;
}
function calculateLines(
  lines: Awaited<ReturnType<typeof refundableLines>>,
  booking: Booking,
  now: Date,
  operator: boolean,
) {
  const captured = lines.reduce((total, line) => total + line.applied, 0);
  const remaining = lines.reduce((total, line) => total + line.available, 0);
  return refundQuote(booking, captured, captured - remaining, now, operator);
}

export function cancellationQuote(actor: Actor, id: string, operator = false) {
  return transaction(async (tx) => {
    const { booking } = await lockCancellation(tx, actor, id, operator);
    const now = new Date();
    eligible(booking.status, booking.startAt, now, operator);
    const lines = await refundableLines(tx, booking);
    return calculateLines(lines, booking, now, operator);
  });
}

export function cancelBooking(
  actor: Actor,
  id: string,
  input: {
    reason: string;
    expectedRefundAmount: number;
    cause?: "WEATHER" | "MAINTENANCE" | "EMERGENCY";
  },
  operator = false,
) {
  return transaction(async (tx) => {
    const { booking, pitch, venue } = await lockCancellation(
      tx,
      actor,
      id,
      operator,
    );
    const existing = await tx.cancellationRequest.findUnique({
      where: { bookingId: id },
    });
    if (existing) return existing;
    const now = new Date();
    eligible(booking.status, booking.startAt, now, operator);
    assertTransition(booking.status, "CANCELLED");
    const lines = await refundableLines(tx, booking);
    const quote = calculateLines(lines, booking, now, operator);
    if (input.expectedRefundAmount !== quote.refundAmount)
      throw new AppError(
        409,
        "REFUND_QUOTE_CHANGED",
        "The refund quote changed. Review it before confirming.",
      );
    const type: CancellationType = operator
      ? (input.cause ??
        (actor.role === "ADMIN" ? "ADMIN_REQUEST" : "OWNER_REQUEST"))
      : "CUSTOMER_REQUEST";
    const cancellation = await tx.cancellationRequest.create({
      data: {
        bookingId: id,
        requestedById: actor.id,
        reason: input.reason,
        cancellationType: type,
        refundAmount: quote.refundAmount,
        status: "PROCESSED",
        processedById: actor.id,
        processedAt: now,
      },
    });
    await tx.booking.update({
      where: { id },
      data: {
        status: "CANCELLED",
        cancelledAt: now,
        cancellationReason: input.reason,
      },
    });
    const { count } = await tx.slot.updateMany({
      where: {
        activeBookingId: id,
        pitchId: pitch.id,
        startAt: { gt: now },
        status: { in: ["HELD", "BOOKED"] },
      },
      data: { activeBookingId: null, status: "AVAILABLE", holdExpiresAt: null },
    });
    await tx.couponRedemption.updateMany({
      where: { bookingId: id, status: "RESERVED" },
      data: { status: "RELEASED" },
    });
    if (count) await refreshPitch(tx, pitch, venue, false, now);
    let outstanding = quote.refundAmount;
    for (const line of lines) {
      const amount = Math.min(outstanding, line.available);
      if (amount > 0)
        await reserveRefund(
          tx,
          booking,
          line.payment,
          `cancellation:${id}:${line.payment.id}`,
          amount,
          "Booking cancellation",
          true,
        );
      outstanding -= amount;
    }
    await bookingAudit(
      tx,
      booking,
      "BOOKING_CANCELLED",
      { cancellationId: cancellation.id, type, released: count },
      actor.id,
    );
    await notify(tx, booking, "BOOKING_CANCELLED");
    return cancellation;
  });
}

export function createPolicy(
  actor: Actor,
  venueId: string,
  input: z.output<typeof policyInput>,
) {
  return transaction(async (tx) => {
    await lockVenue(tx, venueId);
    await requireVenueWrite(tx, actor, venueId, "policies");
    const last = await tx.cancellationPolicy.findFirst({
      where: { venueId },
      orderBy: { version: "desc" },
    });
    return tx.cancellationPolicy.create({
      data: {
        venueId,
        name: input.name,
        description: input.description,
        version: (last?.version ?? 0) + 1,
        rules: {
          create: input.rules.map((rule, priority) => ({ ...rule, priority })),
        },
      },
      include: { rules: true },
    });
  });
}

export function activatePolicy(actor: Actor, id: string) {
  return transaction(async (tx) => {
    const policy = await tx.cancellationPolicy.findUniqueOrThrow({
      where: { id },
    });
    await lockVenue(tx, policy.venueId);
    await requireVenueWrite(tx, actor, policy.venueId, "policies");
    await tx.cancellationPolicy.updateMany({
      where: { venueId: policy.venueId, isActive: true },
      data: { isActive: false },
    });
    const result = await tx.cancellationPolicy.update({
      where: { id },
      data: { isActive: true },
    });
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: "CANCELLATION_POLICY_ACTIVATED",
        entityId: id,
        entityType: "CancellationPolicy",
      },
    });
    return result;
  });
}
