import { AppError } from "@/lib/api";
import type {
  Booking,
  Payment,
  Pitch,
  Prisma,
  Venue,
} from "@/generated/prisma/client";
import {
  lockBooking,
  bookingAudit,
  transaction,
} from "@/modules/bookings/booking.repository";
import {
  assertTransition,
  unavailable,
} from "@/modules/bookings/booking.state-machine";
import { saveQuotedBooking } from "@/modules/bookings/booking.service";
import { quoteSelection } from "@/modules/pricing/pricing.service";
import type { Selection } from "@/modules/bookings/booking.validation";
import type { Actor } from "@/modules/permissions/operations";
import { lockOperationalBooking } from "@/modules/operations/bookings";
import { enqueue, notify } from "@/modules/notifications/service";
import { refreshPitch } from "@/modules/availability/service";
import { reserveRefund, reservedRefunds } from "@/modules/finance/refunds";

const rescheduleConflict = () =>
  new AppError(
    409,
    "RESCHEDULE_UNAVAILABLE",
    "This reservation cannot be moved to that selection.",
  );
const lockSource = (
  tx: Prisma.TransactionClient,
  actor: Actor,
  id: string,
  operator: boolean,
) =>
  operator
    ? lockOperationalBooking(tx, actor, id, "cancel")
    : lockBooking(tx, id, actor.id);

async function getQuote(
  tx: Prisma.TransactionClient,
  source: Booking,
  pitch: Pitch,
  venue: Venue,
  selection: Selection,
  now: Date,
) {
  if (
    source.status !== "CONFIRMED" ||
    source.startAt <= now ||
    source.pitchId !== selection.pitchId ||
    selection.couponCode ||
    source.rescheduledFromId
  )
    throw rescheduleConflict();
  const addons = await tx.bookingAddon.findMany({
    where: { bookingId: source.id },
  });
  const quote = await quoteSelection(
    tx,
    pitch,
    venue,
    {
      ...selection,
      addons: addons.map(({ addonId, quantity }) => ({ addonId, quantity })),
    },
    now,
    undefined,
    false,
    source.id,
  );
  if (
    +quote.items[0].startAt === +source.startAt &&
    +quote.items.at(-1)!.endAt === +source.endAt
  )
    throw rescheduleConflict();
  const payment = source.confirmedPaymentId
    ? await tx.payment.findUniqueOrThrow({
        where: { id: source.confirmedPaymentId },
      })
    : null;
  const applied = payment
    ? payment.amount - (await reservedRefunds(tx, payment.id))
    : 0;
  const difference = quote.totalAmount - applied;
  if (payment && difference > 0 && (difference < 100 || !source.customerId))
    throw new AppError(
      422,
      "RESCHEDULE_BALANCE",
      "A registered customer and at least INR 1 are required for an additional payment.",
    );
  return {
    quote,
    originalAmount: source.totalAmount,
    replacementAmount: quote.totalAmount,
    priceDifference: quote.totalAmount - source.totalAmount,
    amountDue: difference,
    payment,
  };
}

export function rescheduleQuote(
  actor: Actor,
  id: string,
  selection: Selection,
  operator = false,
) {
  return transaction(async (tx) => {
    const { booking, pitch, venue } = await lockSource(tx, actor, id, operator);
    const { payment, ...quote } = await getQuote(
      tx,
      booking,
      pitch,
      venue,
      selection,
      new Date(),
    );
    return { ...quote, amountDue: payment ? quote.amountDue : 0 };
  });
}

export function rescheduleBooking(
  actor: Actor,
  id: string,
  input: Selection & { quoteFingerprint: string },
  operator = false,
) {
  return transaction(async (tx) => {
    const {
      booking: source,
      pitch,
      venue,
    } = await lockSource(tx, actor, id, operator);
    const current = await tx.rescheduleRequest.findUnique({
      where: { originalBookingId: id },
      include: { replacement: true },
    });
    if (current && ["COMPLETED", "AWAITING_PAYMENT"].includes(current.status))
      return current;
    const now = new Date();
    const {
      quote,
      payment,
      originalAmount,
      replacementAmount,
      priceDifference,
      amountDue,
    } = await getQuote(tx, source, pitch, venue, input, now);
    if (quote.fingerprint !== input.quoteFingerprint)
      throw new AppError(
        409,
        "PRICE_CHANGED",
        "The replacement price changed.",
      );
    const expiresAt = new Date(
      Math.min(+source.startAt, +quote.items[0].startAt, +now + 600_000),
    );
    const shared = await tx.slot.findMany({
      where: { activeBookingId: source.id },
      select: { id: true },
    });
    const sharedIds = new Set(shared.map(({ id }) => id));
    const replacement = await saveQuotedBooking(
      tx,
      {
        customerId: source.customerId,
        guestCustomerId: source.guestCustomerId,
        createdById: actor.id,
        bookingSource: source.bookingSource,
        customerName: source.customerName,
        customerEmail: source.customerEmail,
        customerPhone: source.customerPhone,
        playerCount: source.playerCount,
        holdExpiresAt: expiresAt,
      },
      pitch,
      venue,
      quote,
      now,
      sharedIds,
    );
    const needsPayment = !!payment && amountDue > 0;
    await tx.booking.update({
      where: { id: replacement.id },
      data: {
        rescheduledFromId: id,
        settlementDue: needsPayment ? amountDue : payment ? 0 : null,
        ...(source.cancellationPolicySnapshot
          ? { cancellationPolicySnapshot: source.cancellationPolicySnapshot }
          : {}),
      },
    });
    const values = {
      replacementBookingId: replacement.id,
      requestedById: actor.id,
      originalAmount,
      replacementAmount,
      priceDifference,
      expiresAt,
      status: "AWAITING_PAYMENT" as const,
    };
    const request = await tx.rescheduleRequest.upsert({
      where: { originalBookingId: id },
      create: { originalBookingId: id, ...values },
      update: values,
    });
    await bookingAudit(
      tx,
      source,
      "RESCHEDULE_REQUESTED",
      { replacementId: replacement.id },
      actor.id,
    );
    if (!needsPayment) {
      const confirmed = await finalizeReplacement(
        tx,
        replacement,
        pitch,
        venue,
        null,
        now,
      );
      if (!confirmed) throw rescheduleConflict();
    }
    return tx.rescheduleRequest.findUniqueOrThrow({
      where: { id: request.id },
      include: { replacement: true },
    });
  });
}

// Both bookings share the same locked venue and pitch. Shared slots transfer directly.
export async function finalizeReplacement(
  tx: Prisma.TransactionClient,
  replacement: Booking,
  pitch: Pitch,
  venue: Venue,
  newPayment: Payment | null,
  now: Date,
) {
  const request = await tx.rescheduleRequest.findUnique({
    where: { replacementBookingId: replacement.id },
    include: { original: { include: { confirmedPayment: true } } },
  });
  if (
    !request ||
    request.status !== "AWAITING_PAYMENT" ||
    request.expiresAt <= now ||
    request.original.status !== "CONFIRMED" ||
    request.original.startAt <= now
  )
    return false;
  const source = request.original;
  const items = await tx.bookingItem.findMany({
    where: { bookingId: replacement.id },
    select: { originalSlotId: true },
  });
  const ids = items.map(({ originalSlotId }) => originalSlotId);
  const where: Prisma.SlotWhereInput = {
    id: { in: ids },
    pitchId: pitch.id,
    OR: [
      {
        status: "HELD",
        activeBookingId: replacement.id,
        holdExpiresAt: { gt: now },
      },
      { status: "BOOKED", activeBookingId: source.id },
    ],
  };
  if (!ids.length || (await tx.slot.count({ where })) !== ids.length)
    return false;
  const payment = source.confirmedPayment;
  const remaining = payment
    ? payment.amount - (await reservedRefunds(tx, payment.id))
    : 0;
  if (
    payment &&
    remaining + (newPayment?.amount ?? 0) < replacement.totalAmount
  )
    return false;

  assertTransition(source.status, "RESCHEDULED");
  assertTransition(replacement.status, "CONFIRMED");
  if (
    (
      await tx.slot.updateMany({
        where,
        data: {
          activeBookingId: replacement.id,
          status: "BOOKED",
          holdExpiresAt: null,
        },
      })
    ).count !== ids.length
  )
    throw unavailable();
  const released = await tx.slot.updateMany({
    where: { activeBookingId: source.id, pitchId: pitch.id, status: "BOOKED" },
    data: { activeBookingId: null, status: "AVAILABLE", holdExpiresAt: null },
  });
  await tx.booking.update({
    where: { id: source.id },
    data: { status: "RESCHEDULED" },
  });
  await tx.booking.update({
    where: { id: replacement.id },
    data: {
      status: "CONFIRMED",
      confirmedAt: now,
      confirmedPaymentId: newPayment?.id,
    },
  });
  if (released.count) await refreshPitch(tx, pitch, venue, false, now);
  if (payment) {
    const transferred = Math.min(remaining, replacement.totalAmount);
    if (transferred)
      await tx.paymentAllocation.create({
        data: {
          bookingId: replacement.id,
          paymentId: payment.id,
          amount: transferred,
        },
      });
    if (remaining > transferred)
      await reserveRefund(
        tx,
        source,
        payment,
        `reschedule:${request.id}`,
        remaining - transferred,
        "Rescheduling price reduction",
      );
  }
  if (newPayment)
    await tx.paymentAllocation.create({
      data: {
        bookingId: replacement.id,
        paymentId: newPayment.id,
        amount: newPayment.amount,
      },
    });
  await tx.rescheduleRequest.update({
    where: { id: request.id },
    data: { status: "COMPLETED", processedAt: now },
  });
  await bookingAudit(
    tx,
    source,
    "BOOKING_RESCHEDULED",
    { replacementId: replacement.id },
    request.requestedById,
  );
  await notify(tx, replacement, "RESCHEDULED");
  if (payment || newPayment)
    await enqueue(
      tx,
      "BOOKING_RECEIPT",
      replacement.id,
      `receipt:${replacement.id}`,
    );
  return true;
}
