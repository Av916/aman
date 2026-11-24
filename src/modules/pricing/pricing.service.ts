import { createHash } from "node:crypto";
import { AppError } from "@/lib/api";
import { getPrisma } from "@/lib/prisma";
import type { Prisma, Pitch, Venue } from "@/generated/prisma/client";
import { bookingSettings } from "@/modules/bookings/settings";
import type { Selection } from "@/modules/bookings/booking.validation";
import { unavailable } from "@/modules/bookings/booking.state-machine";
import { atVenueTime, localDay, shiftDay } from "@/modules/schedules/time";
import { venueSettings } from "@/modules/venues/settings";
import { publicVenueWhere } from "@/modules/venues/venue.types";
import { resolveCoupon } from "@/modules/coupons/service";
import { calculatePrice, validateSlotSequence } from "./pricing.calculator";

export async function quoteSelection(
  db: Prisma.TransactionClient,
  pitch: Pitch,
  venue: Pick<
    Venue,
    "id" | "timezone" | "status" | "publishedAt" | "deletedAt"
  >,
  input: Selection,
  now: Date,
  customerId?: string,
  lockCoupon = false,
  ownBookingId?: string,
) {
  if (
    venue.status !== "APPROVED" ||
    !venue.publishedAt ||
    venue.deletedAt ||
    !pitch.isActive
  )
    throw unavailable();
  const limit = atVenueTime(
    shiftDay(
      localDay(now, venue.timezone),
      venueSettings().SLOT_GENERATION_DAYS,
    ),
    0,
    venue.timezone,
  );
  const slots = await db.slot.findMany({
    where: { id: { in: input.slotIds }, pitchId: pitch.id },
    orderBy: { startAt: "asc" },
  });
  if (
    slots.length !== input.slotIds.length ||
    slots.some(
      (slot) =>
        !(
          (slot.status === "AVAILABLE" && !slot.activeBookingId) ||
          (slot.status === "BOOKED" &&
            ownBookingId &&
            slot.activeBookingId === ownBookingId)
        ) ||
        slot.startAt <= now ||
        slot.startAt >= limit,
    )
  )
    throw unavailable();

  const durationMinutes = validateSlotSequence(slots, pitch);
  const quantity = new Map(
    input.addons.map((item) => [item.addonId, item.quantity]),
  );
  const addons = await db.addon.findMany({
    where: {
      id: { in: [...quantity.keys()] },
      venueId: venue.id,
      isActive: true,
    },
    orderBy: { id: "asc" },
  });
  if (addons.length !== quantity.size)
    throw new AppError(
      422,
      "ADDON_UNAVAILABLE",
      "One or more add-ons are unavailable at this venue.",
    );
  const { PLATFORM_FEE_PAISE, TAX_RATE_BPS } = bookingSettings();
  const fee = await db.platformSetting.findUnique({
    where: { key: "platformFeePaise" },
    select: { amount: true },
  });
  if (input.couponCode && !customerId)
    throw new AppError(
      422,
      "COUPON_CUSTOMER",
      "Sign in as a customer to use a coupon.",
    );
  const coupon =
    input.couponCode && customerId
      ? await resolveCoupon(
          db,
          input.couponCode,
          venue.id,
          customerId,
          slots.reduce((sum, slot) => sum + slot.price, 0),
          now,
          lockCoupon,
        )
      : null;
  const price = calculatePrice(
    slots.map((slot) => slot.price),
    durationMinutes,
    addons.map((addon) => ({ ...addon, quantity: quantity.get(addon.id)! })),
    fee?.amount ?? PLATFORM_FEE_PAISE,
    TAX_RATE_BPS,
    coupon?.amount ?? 0,
  );
  const items = slots.map(({ id, startAt, endAt, price }) => ({
    slotId: id,
    startAt,
    endAt,
    durationMinutes: pitch.slotDurationMinutes,
    unitPrice: price,
  }));
  const breakdown = {
    pitchId: pitch.id,
    timezone: venue.timezone,
    currency: "INR",
    items,
    durationMinutes,
    ...price,
    coupon,
  };
  return {
    ...breakdown,
    fingerprint: createHash("sha256")
      .update(JSON.stringify(breakdown))
      .digest("hex"),
  };
}

export async function publicQuote(input: Selection, customerId?: string) {
  const db = getPrisma();
  const pitch = await db.pitch.findFirst({
    where: { id: input.pitchId, isActive: true, venue: publicVenueWhere },
    include: { venue: true },
  });
  if (!pitch) throw unavailable();
  return quoteSelection(db, pitch, pitch.venue, input, new Date(), customerId);
}
