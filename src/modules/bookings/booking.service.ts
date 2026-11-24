import { createHash, randomBytes } from "node:crypto";
import { AppError } from "@/lib/api";
import { quoteSelection } from "@/modules/pricing/pricing.service";
import {
  holdSlots,
  lockBookablePitch,
} from "@/modules/inventory/slot-lock.service";
import { releaseLockedBooking } from "@/modules/inventory/slot-release.service";
import { bookingSettings } from "./settings";
import { transaction, lockBooking, bookingAudit } from "./booking.repository";
import { holdExpired, expired } from "./booking.state-machine";
import type { CreateBookingInput, CheckoutInput } from "./booking.validation";
import { getPrisma } from "@/lib/prisma";
import { snapshotPolicy } from "@/modules/cancellations/policy";
import type { Prisma } from "@/generated/prisma/client";

export async function createBooking(
  customerId: string,
  input: CreateBookingInput,
  idempotencyKey: string,
) {
  const requestHash = createHash("sha256")
    .update(
      JSON.stringify({
        pitchId: input.pitchId,
        coupon: input.couponCode,
        slots: [...input.slotIds].sort(),
        addons: [...input.addons].sort((a, b) =>
          a.addonId.localeCompare(b.addonId),
        ),
        fingerprint: input.quoteFingerprint,
      }),
    )
    .digest("hex");
  // Expire stale holds in their own transactions so a subsequent quote conflict
  // cannot roll the cleanup back.
  const stale = await getPrisma().slot.findMany({
    where: {
      id: { in: input.slotIds },
      pitchId: input.pitchId,
      status: "HELD",
      holdExpiresAt: { lte: new Date() },
    },
    select: { activeBookingId: true },
    distinct: ["activeBookingId"],
  });
  for (const { activeBookingId } of stale)
    if (activeBookingId) await expireBooking(activeBookingId);

  return transaction(async (tx) => {
    const [profile] = await tx.$queryRaw<
      { name: string; email: string; phone: string | null }[]
    >`
      SELECT name, email, phone FROM "User"
      WHERE id = ${customerId}::uuid AND role = 'CUSTOMER' AND status = 'ACTIVE' FOR UPDATE
    `;
    if (!profile)
      throw new AppError(403, "FORBIDDEN", "A customer account is required.");
    const key = {
      userId: customerId,
      operation: "CREATE_BOOKING",
      idempotencyKey,
    };
    const previous = await tx.idempotencyRecord.findUnique({
      where: { userId_operation_idempotencyKey: key },
    });
    if (previous) {
      if (previous.requestHash !== requestHash)
        throw new AppError(
          409,
          "IDEMPOTENCY_MISMATCH",
          "This request key was already used with another selection.",
        );
      return {
        booking: await tx.booking.findUniqueOrThrow({
          where: { id: previous.resourceId },
        }),
        replay: true,
      };
    }
    const { venue, pitch } = await lockBookablePitch(
      tx,
      input.pitchId,
      input.slotIds,
    );
    const now = new Date();
    const settings = bookingSettings();
    const count = await tx.booking.count({
      where: {
        customerId,
        status: "PENDING_PAYMENT",
        holdExpiresAt: { gt: now },
      },
    });
    if (count >= settings.MAX_ACTIVE_HOLDS_PER_USER)
      throw new AppError(
        409,
        "ACTIVE_HOLD_LIMIT",
        "Finish or release your existing hold from My Bookings.",
      );
    const quote = await quoteSelection(
      tx,
      pitch,
      venue,
      input,
      now,
      customerId,
      true,
    );
    if (quote.fingerprint !== input.quoteFingerprint)
      throw new AppError(
        409,
        "PRICE_CHANGED",
        "The price changed. Review the refreshed quote before continuing.",
      );
    if (quote.totalAmount < 100)
      throw new AppError(
        422,
        "PAYMENT_MINIMUM",
        "The payable amount must be at least INR 1.",
      );
    const holdExpiresAt = new Date(
      Math.min(
        +now + settings.BOOKING_HOLD_MINUTES * 60_000,
        +quote.items[0].startAt,
      ),
    );
    const booking = await saveQuotedBooking(
      tx,
      {
        customerId,
        holdExpiresAt,
        customerName: profile.name,
        customerEmail: profile.email,
        customerPhone: profile.phone,
        playerCount: Math.min(2, pitch.capacity),
      },
      pitch,
      venue,
      quote,
      now,
    );
    if (quote.coupon)
      await tx.couponRedemption.create({
        data: {
          couponId: quote.coupon.id,
          bookingId: booking.id,
          customerId,
          discountAmount: quote.coupon.amount,
          status: "RESERVED",
          expiresAt: holdExpiresAt,
        },
      });
    await tx.idempotencyRecord.create({
      data: {
        ...key,
        requestHash,
        resourceId: booking.id,
        expiresAt: new Date(+now + 30 * 86400_000),
      },
    });
    await bookingAudit(tx, booking, "BOOKING_HELD", {
      slots: quote.items.length,
    });
    return { booking, replay: false };
  });
}

export async function saveQuotedBooking(
  tx: Prisma.TransactionClient,
  details: Pick<
    Prisma.BookingUncheckedCreateInput,
    | "customerId"
    | "guestCustomerId"
    | "createdById"
    | "bookingSource"
    | "customerName"
    | "customerEmail"
    | "customerPhone"
    | "playerCount"
    | "internalNotes"
  > & { holdExpiresAt: Date },
  pitch: { id: string; name: string },
  venue: {
    id: string;
    name: string;
    address: string;
    locality: string;
    city: string;
    state: string;
    timezone: string;
  },
  quote: Awaited<ReturnType<typeof quoteSelection>>,
  now: Date,
  sharedSlots = new Set<string>(),
) {
  const booking = await tx.booking.create({
    data: {
      ...details,
      bookingNumber: `PM-${now.toISOString().slice(0, 10).replaceAll("-", "")}-${randomBytes(6).toString("hex").toUpperCase()}`,
      venueId: venue.id,
      pitchId: pitch.id,
      venueName: venue.name,
      venueAddress: [venue.address, venue.locality, venue.city, venue.state]
        .filter(Boolean)
        .join(", "),
      pitchName: pitch.name,
      timezone: venue.timezone,
      startAt: quote.items[0].startAt,
      endAt: quote.items.at(-1)!.endAt,
      durationMinutes: quote.durationMinutes,
      currency: quote.currency,
      subtotal: quote.subtotal,
      addonTotal: quote.addonTotal,
      discountAmount: quote.discountAmount,
      platformFee: quote.platformFee,
      taxAmount: quote.taxAmount,
      totalAmount: quote.totalAmount,
      cancellationPolicySnapshot: await snapshotPolicy(tx, venue.id),
    },
  });
  const claim = quote.items
    .map((item) => item.slotId)
    .filter((id) => !sharedSlots.has(id));
  if (claim.length)
    await holdSlots(
      tx,
      pitch.id,
      booking.id,
      claim,
      details.holdExpiresAt,
      now,
    );
  await tx.bookingItem.createMany({
    data: quote.items.map((item) => ({
      ...item,
      bookingId: booking.id,
      originalSlotId: item.slotId,
    })),
  });
  if (quote.addons.length)
    await tx.bookingAddon.createMany({
      data: quote.addons.map((item) => ({ ...item, bookingId: booking.id })),
    });
  return booking;
}

export async function expireBooking(id: string, customerId?: string) {
  return transaction(async (tx) => {
    const { booking, pitch, venue } = await lockBooking(tx, id, customerId);
    const now = new Date();
    if (
      booking.status === "PENDING_PAYMENT" &&
      holdExpired(booking.holdExpiresAt, now)
    )
      return releaseLockedBooking(tx, booking, pitch, venue, "EXPIRED", now);
    return booking;
  });
}

export async function releaseBooking(id: string, customerId: string) {
  const result = await transaction(async (tx) => {
    const { booking, pitch, venue } = await lockBooking(tx, id, customerId);
    if (booking.status === "CANCELLED" || booking.status === "EXPIRED")
      return booking;
    if (booking.status !== "PENDING_PAYMENT")
      throw new AppError(
        409,
        "HOLD_NOT_RELEASABLE",
        "Only unpaid holds can be released here.",
      );
    const now = new Date();
    return releaseLockedBooking(
      tx,
      booking,
      pitch,
      venue,
      holdExpired(booking.holdExpiresAt, now) ? "EXPIRED" : "CANCELLED",
      now,
    );
  });
  if (result.status === "EXPIRED") throw expired();
  return result;
}

export async function saveCheckout(
  id: string,
  customerId: string,
  { termsAccepted, ...input }: CheckoutInput,
) {
  const state = await transaction(async (tx) => {
    const { booking, pitch, venue } = await lockBooking(tx, id, customerId);
    const now = new Date();
    if (
      booking.status === "PENDING_PAYMENT" &&
      holdExpired(booking.holdExpiresAt, now)
    )
      return releaseLockedBooking(tx, booking, pitch, venue, "EXPIRED", now);
    if (booking.status !== "PENDING_PAYMENT") return booking;
    if (input.playerCount > pitch.capacity)
      throw new AppError(
        422,
        "PITCH_CAPACITY",
        "Player count exceeds pitch capacity.",
      );
    return tx.booking.update({
      where: { id },
      data: { ...input, termsAcceptedAt: termsAccepted ? now : null },
    });
  });
  if (state.status === "EXPIRED") throw expired();
  if (state.status !== "PENDING_PAYMENT")
    throw new AppError(
      409,
      "BOOKING_NOT_PAYABLE",
      "This booking no longer accepts payments.",
    );
  return state;
}
