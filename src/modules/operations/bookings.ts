import { bookingSettings } from "@/modules/bookings/settings";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { AppError } from "@/lib/api";
import { getEnv } from "@/lib/env";
import type { Booking, Prisma } from "@/generated/prisma/client";
import { selection } from "@/modules/bookings/booking.validation";
import {
  bookingAudit,
  lockBooking,
  transaction,
} from "@/modules/bookings/booking.repository";
import {
  assertTransition,
  bookingMissing,
  unavailable,
} from "@/modules/bookings/booking.state-machine";
import { saveQuotedBooking } from "@/modules/bookings/booking.service";
import { lockBookablePitch } from "@/modules/inventory/slot-lock.service";
import { quoteSelection } from "@/modules/pricing/pricing.service";
import {
  requireVenueAccess,
  requireVenueWrite,
  type Actor,
  type Permission,
  venueScope,
} from "@/modules/permissions/operations";
import { postCapture, postCharges } from "@/modules/finance/ledger";
import {
  enqueue,
  notify,
  queueOperationalEmail,
} from "@/modules/notifications/service";
import { getPrisma } from "@/lib/prisma";
import { phone } from "@/modules/auth/schemas";

export const offlineMethod = z.enum([
  "CASH",
  "UPI_OFFLINE",
  "CARD_OFFLINE",
  "BANK_TRANSFER",
]);
export const manualInput = selection.extend({
  identity: z.discriminatedUnion("type", [
    z.strictObject({
      type: z.literal("guest"),
      name: z.string().trim().min(2).max(80),
      phone,
      email: z.email().max(254).optional(),
    }),
    z.strictObject({
      type: z.literal("customer"),
      email: z.email().max(254).toLowerCase(),
    }),
  ]),
  source: z.enum(["WALK_IN", "PHONE", "OWNER_MANUAL"]),
  paymentMethod: z.union([offlineMethod, z.enum(["UNPAID", "RAZORPAY"])]),
  quoteFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  playerCount: z.number().int().min(1).max(500),
  notes: z.string().trim().max(500).optional(),
});

export async function lockOperationalBooking(
  tx: Prisma.TransactionClient,
  actor: Actor,
  id: string,
  permission: Permission,
) {
  const target = await tx.booking.findFirst({
    where: { id, venue: venueScope(actor, permission) },
    select: { venueId: true },
  });
  if (!target) throw bookingMissing();
  const locked = await lockBooking(tx, id);
  await requireVenueWrite(tx, actor, locked.booking.venueId, permission);
  return locked;
}

async function captureOffline(
  tx: Prisma.TransactionClient,
  actor: Actor,
  booking: Booking,
  method: z.infer<typeof offlineMethod>,
  now: Date,
) {
  if (booking.confirmedPaymentId) {
    const original = await tx.payment.findUniqueOrThrow({
      where: { id: booking.confirmedPaymentId },
    });
    if (original.provider === "OFFLINE" && original.paymentMethod === method)
      return original;
    throw new AppError(
      409,
      "PAYMENT_EXISTS",
      "A payment has already been applied to this booking.",
    );
  }
  if (booking.totalAmount <= 0)
    throw new AppError(
      422,
      "NOTHING_DUE",
      "This booking has no balance to collect.",
    );
  const payment = await tx.payment.create({
    data: {
      bookingId: booking.id,
      provider: "OFFLINE",
      providerPaymentId: `offline:${booking.id}`,
      amount: booking.totalAmount,
      currency: booking.currency,
      status: "CAPTURED",
      paymentMethod: method,
      paidAt: now,
    },
  });
  await tx.booking.update({
    where: { id: booking.id },
    data: { confirmedPaymentId: payment.id },
  });
  await postCapture(tx, booking, payment, now);
  await postCharges(tx, booking, payment.id, now);
  await enqueue(tx, "BOOKING_RECEIPT", booking.id, `receipt:${booking.id}`);
  await bookingAudit(
    tx,
    booking,
    "OFFLINE_PAYMENT_RECORDED",
    { paymentId: payment.id, method },
    actor.id,
  );
  return payment;
}

export function recordOfflinePayment(
  actor: Actor,
  id: string,
  method: z.infer<typeof offlineMethod>,
) {
  return transaction(async (tx) => {
    const { booking } = await lockOperationalBooking(tx, actor, id, "collect");
    if (
      booking.bookingSource === "ONLINE" ||
      booking.settlementDue !== null ||
      !["CONFIRMED", "CHECKED_IN", "COMPLETED", "NO_SHOW"].includes(
        booking.status,
      )
    )
      throw new AppError(
        409,
        "COLLECTION_UNAVAILABLE",
        "This booking does not accept offline collection.",
      );
    return captureOffline(tx, actor, booking, method, new Date());
  });
}

export async function operationalQuote(
  actor: Actor,
  input: z.output<typeof selection>,
) {
  const db = getPrisma();
  const pitch = await db.pitch.findFirst({
    where: { id: input.pitchId, venue: venueScope(actor, "reserve") },
    include: { venue: true },
  });
  if (!pitch) throw unavailable();
  return quoteSelection(db, pitch, pitch.venue, input, new Date());
}

export function createManualBooking(
  actor: Actor,
  input: z.output<typeof manualInput>,
  idempotencyKey: string,
) {
  return transaction(async (tx) => {
    const scope = await tx.pitch.findFirst({
      where: { id: input.pitchId, venue: venueScope(actor, "reserve") },
      select: { venueId: true },
    });
    if (!scope) throw unavailable();
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${actor.id}::uuid FOR UPDATE`;
    const key = {
      userId: actor.id,
      operation: "MANUAL_BOOKING",
      idempotencyKey,
    };
    const requestHash = createHash("sha256")
      .update(JSON.stringify(input))
      .digest("hex");
    const previous = await tx.idempotencyRecord.findUnique({
      where: { userId_operation_idempotencyKey: key },
    });
    if (previous) {
      await requireVenueAccess(tx, actor, scope.venueId, "reserve");
      if (previous.requestHash !== requestHash)
        throw new AppError(
          409,
          "IDEMPOTENCY_MISMATCH",
          "This request key already has different booking details.",
        );
      return tx.booking.findUniqueOrThrow({
        where: { id: previous.resourceId },
      });
    }

    const { venue, pitch } = await lockBookablePitch(
      tx,
      input.pitchId,
      input.slotIds,
    );
    await requireVenueWrite(tx, actor, venue.id, "reserve");
    const usesCheckout = input.paymentMethod === "RAZORPAY";
    if (!usesCheckout && input.paymentMethod !== "UNPAID")
      await requireVenueWrite(tx, actor, venue.id, "collect");
    if (input.playerCount > pitch.capacity)
      throw new AppError(
        422,
        "PITCH_CAPACITY",
        "Player count exceeds pitch capacity.",
      );
    const now = new Date();
    const quote = await quoteSelection(tx, pitch, venue, input, now);
    if (quote.fingerprint !== input.quoteFingerprint)
      throw new AppError(
        409,
        "PRICE_CHANGED",
        "Review an updated quote before confirming.",
      );
    const identity = input.identity;
    let customer;
    let guest;
    if (identity.type === "customer") {
      customer = await tx.user.findFirst({
        where: {
          email: identity.email,
          role: "CUSTOMER",
          status: "ACTIVE",
          emailVerified: { not: null },
        },
        select: { id: true, name: true, email: true, phone: true },
      });
      if (!customer)
        throw new AppError(
          404,
          "CUSTOMER_NOT_FOUND",
          "No eligible customer uses that email.",
        );
    } else {
      const phone = identity.phone.replace(/[^+0-9]/g, "");
      guest =
        (await tx.guestCustomer.findFirst({
          where: {
            venueId: venue.id,
            phone,
            name: { equals: identity.name, mode: "insensitive" },
          },
          orderBy: { createdAt: "asc" },
        })) ??
        (await tx.guestCustomer.create({
          data: {
            venueId: venue.id,
            name: identity.name,
            phone,
            email: identity.email,
          },
        }));
    }
    if (quote.totalAmount < 100 || (usesCheckout && !customer))
      throw new AppError(
        422,
        "PAYMENT_MINIMUM",
        "Bookings need at least INR 1. Online checkout also requires a registered customer.",
      );
    const contact = customer ?? guest!;
    const holdExpiresAt = usesCheckout
      ? new Date(
          Math.min(
            +quote.items[0].startAt,
            +now + bookingSettings().BOOKING_HOLD_MINUTES * 60_000,
          ),
        )
      : quote.items[0].startAt;
    const booking = await saveQuotedBooking(
      tx,
      {
        customerId: customer?.id,
        guestCustomerId: guest?.id,
        createdById: actor.id,
        bookingSource: actor.role === "ADMIN" ? "ADMIN_MANUAL" : input.source,
        customerName: contact.name,
        customerEmail:
          identity.type === "guest" ? (identity.email ?? null) : contact.email,
        customerPhone: contact.phone,
        playerCount: input.playerCount,
        internalNotes: input.notes,
        holdExpiresAt,
      },
      pitch,
      venue,
      quote,
      now,
    );
    let confirmed = booking;
    if (usesCheckout && contact.email) {
      const url = new URL(`/checkout/${booking.id}`, getEnv().APP_URL);
      await queueOperationalEmail(
        tx,
        booking.id,
        `manual-checkout:${booking.id}`,
        contact.email,
        "Complete your PitchMate reservation",
        `${booking.bookingNumber} is held until ${holdExpiresAt.toISOString()}. Sign in to pay at ${url.href}`,
      );
    } else {
      assertTransition(booking.status, "CONFIRMED");
      const booked = await tx.slot.updateMany({
        where: { activeBookingId: booking.id, status: "HELD" },
        data: { status: "BOOKED", holdExpiresAt: null },
      });
      if (booked.count !== quote.items.length) throw unavailable();
      confirmed = await tx.booking.update({
        where: { id: booking.id },
        data: { status: "CONFIRMED", confirmedAt: now },
      });
      if (
        input.paymentMethod !== "UNPAID" &&
        input.paymentMethod !== "RAZORPAY"
      ) {
        const payment = await captureOffline(
          tx,
          actor,
          confirmed,
          input.paymentMethod,
          now,
        );
        confirmed = { ...confirmed, confirmedPaymentId: payment.id };
      }
      await notify(tx, confirmed, "BOOKING_CONFIRMED");
    }
    await tx.idempotencyRecord.create({
      data: {
        ...key,
        requestHash,
        resourceId: booking.id,
        expiresAt: new Date(+now + 30 * 86400_000),
      },
    });
    await bookingAudit(
      tx,
      booking,
      "MANUAL_BOOKING_CREATED",
      { source: booking.bookingSource },
      actor.id,
    );
    return confirmed;
  });
}

export const tokenHash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const checkInOpens = (start: Date) =>
  new Date(+start - bookingSettings().CHECK_IN_EARLY_MINUTES * 60_000);

export function issueCheckInToken(actor: Actor, id: string) {
  return transaction(async (tx) => {
    const { booking } = await lockBooking(tx, id, actor.id);
    const now = new Date();
    if (
      booking.status !== "CONFIRMED" ||
      now < checkInOpens(booking.startAt) ||
      now >= booking.endAt
    )
      throw new AppError(
        409,
        "CHECK_IN_WINDOW",
        "Check-in is available shortly before the booking until its scheduled end.",
      );
    await tx.checkInToken.deleteMany({
      where: { bookingId: id, usedAt: null },
    });
    const token = randomBytes(24).toString("base64url");
    const expiresAt = new Date(Math.min(+booking.endAt, +now + 10 * 60_000));
    await tx.checkInToken.create({
      data: { bookingId: id, tokenHash: tokenHash(token), expiresAt },
    });
    return { token, expiresAt };
  });
}

export function attendance(
  actor: Actor,
  id: string,
  next: "CHECKED_IN" | "COMPLETED" | "NO_SHOW",
  token?: string,
) {
  return transaction(async (tx) => {
    const { booking } = await lockOperationalBooking(tx, actor, id, "attend");
    if (booking.status === next) return booking;
    assertTransition(booking.status, next);
    const now = new Date();
    if (next === "CHECKED_IN") {
      if (now < checkInOpens(booking.startAt) || now >= booking.endAt)
        throw new AppError(
          409,
          "CHECK_IN_WINDOW",
          "This booking is outside its check-in window.",
        );
      if (token) {
        const changed = await tx.checkInToken.updateMany({
          where: {
            bookingId: id,
            tokenHash: tokenHash(token),
            expiresAt: { gt: now },
            usedAt: null,
          },
          data: { usedAt: now, usedById: actor.id },
        });
        if (changed.count !== 1)
          throw new AppError(
            409,
            "INVALID_CHECK_IN_TOKEN",
            "The check-in token is invalid or expired.",
          );
      }
    } else if (
      now < booking.endAt ||
      (next === "COMPLETED" && booking.status !== "CHECKED_IN")
    ) {
      throw new AppError(
        409,
        "ATTENDANCE_NOT_ELIGIBLE",
        "This action is available after the session ends. Completion requires check-in.",
      );
    }
    const data: Prisma.BookingUncheckedUpdateInput = { status: next };
    if (next === "CHECKED_IN")
      Object.assign(data, { checkedInAt: now, checkedInById: actor.id });
    if (next === "COMPLETED") data.completedAt = now;
    if (next === "NO_SHOW") data.noShowAt = now;
    const updated = await tx.booking.update({ where: { id }, data });
    await bookingAudit(tx, updated, `BOOKING_${next}`, undefined, actor.id);
    if (next === "CHECKED_IN") await notify(tx, updated, "CHECKED_IN");
    return updated;
  });
}
