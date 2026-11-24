import { z } from "zod";
import {
  BookingSource,
  BookingStatus,
  PaymentStatus,
  type Prisma,
} from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { AppError } from "@/lib/api";
import { atVenueTime, localDay, shiftDay } from "@/modules/schedules/time";
import {
  type Actor,
  type Permission,
  requireVenueAccess,
  venueScope,
} from "@/modules/permissions/operations";

export const operationQuery = z.object({
  venueId: z.uuid().optional(),
  pitchId: z.uuid().optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  status: z.enum(BookingStatus).optional(),
  source: z.enum(BookingSource).optional(),
  payment: z.union([z.enum(PaymentStatus), z.literal("UNPAID")]).optional(),
  search: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  sort: z.enum(["asc", "desc"]).default("desc"),
});
export type OperationQuery = z.output<typeof operationQuery>;

export async function operationVenues(
  actor: Actor,
  permission: Permission = "calendar",
) {
  return getPrisma().venue.findMany({
    where: venueScope(actor, permission),
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      timezone: true,
      pitches: {
        select: { id: true, name: true, capacity: true, isActive: true },
        orderBy: { name: "asc" },
      },
    },
  });
}

export function operationRange(
  query: Pick<OperationQuery, "from" | "to">,
  timezone: string,
  days: number,
  maximum = 93,
) {
  const fromDay = query.from ?? localDay(new Date(), timezone);
  const toDay = query.to ?? shiftDay(fromDay, days - 1);
  const from = atVenueTime(fromDay, 0, timezone);
  const to = atVenueTime(shiftDay(toDay, 1), 0, timezone);
  if (from >= to || toDay >= shiftDay(fromDay, maximum))
    throw new AppError(
      422,
      "INVALID_DATE_RANGE",
      `Choose a date range of at most ${maximum} days.`,
    );
  return { from, to, fromDay, toDay };
}

export function paymentFilter(
  payment: OperationQuery["payment"],
): Prisma.BookingWhereInput {
  if (payment === "UNPAID")
    return {
      confirmedPaymentId: null,
      allocations: { none: {} },
      status: { in: ["CONFIRMED", "CHECKED_IN", "COMPLETED", "NO_SHOW"] },
    };
  if (payment === "CAPTURED")
    return {
      OR: [
        { confirmedPayment: { is: { status: "CAPTURED" } } },
        {
          confirmedPaymentId: null,
          allocations: { some: {} },
          status: { not: "CANCELLED" },
        },
      ],
    };
  return payment ? { confirmedPayment: { is: { status: payment } } } : {};
}

const summary = {
  id: true,
  bookingNumber: true,
  bookingSource: true,
  customerName: true,
  venueName: true,
  pitchName: true,
  pitchId: true,
  venueId: true,
  startAt: true,
  endAt: true,
  durationMinutes: true,
  timezone: true,
  status: true,
  totalAmount: true,
  confirmedPayment: { select: { status: true, paymentMethod: true } },
  _count: { select: { allocations: true } },
} satisfies Prisma.BookingSelect;

export async function calendar(actor: Actor, query: OperationQuery) {
  const db = getPrisma();
  const venue = query.venueId
    ? await requireVenueAccess(db, actor, query.venueId, "calendar")
    : (await operationVenues(actor))[0];
  if (!venue) return { venue: null, slots: [], bookings: [], addons: [] };
  const range = operationRange(query, venue.timezone, 7, 31);
  const where = { venueId: venue.id, pitchId: query.pitchId };
  const [slots, bookings, addons] = await Promise.all([
    db.slot.findMany({
      where: {
        pitch: { venueId: venue.id },
        pitchId: query.pitchId,
        startAt: { lt: range.to },
        endAt: { gt: range.from },
      },
      orderBy: [{ startAt: "asc" }, { pitchId: "asc" }],
      select: {
        id: true,
        blockReason: true,
        activeBookingId: true,
        pitchId: true,
        startAt: true,
        endAt: true,
        status: true,
        price: true,
        pitch: { select: { name: true } },
      },
      take: 20000,
    }),
    db.booking.findMany({
      where: {
        ...where,
        startAt: { lt: range.to },
        endAt: { gt: range.from },
        status: query.status,
      },
      select: summary,
      orderBy: { startAt: "asc" },
      take: 5000,
    }),
    db.addon.findMany({
      where: { venueId: venue.id, isActive: true },
      select: { id: true, name: true, price: true, pricingType: true },
    }),
  ]);
  return {
    venue: { id: venue.id, name: venue.name, timezone: venue.timezone },
    slots,
    bookings,
    addons,
  };
}

export async function reservationList(actor: Actor, query: OperationQuery) {
  const db = getPrisma();
  const venues = query.venueId
    ? [await requireVenueAccess(db, actor, query.venueId, "calendar")]
    : await operationVenues(actor);
  const where: Prisma.BookingWhereInput = {
    venue: venueScope(actor, "calendar"),
    pitchId: query.pitchId,
    OR: venues.map(({ id, timezone }) => {
      const range =
        query.from || query.to ? operationRange(query, timezone, 1) : null;
      return {
        venueId: id,
        ...(range ? { startAt: { gte: range.from, lt: range.to } } : {}),
      };
    }),
    status: query.status,
    bookingSource: query.source,
    AND: [
      paymentFilter(query.payment),
      ...(query.search
        ? [
            {
              OR: [
                {
                  bookingNumber: {
                    contains: query.search,
                    mode: "insensitive" as const,
                  },
                },
                {
                  customerName: {
                    contains: query.search,
                    mode: "insensitive" as const,
                  },
                },
              ],
            },
          ]
        : []),
    ],
  };
  const [bookings, total] = await Promise.all([
    db.booking.findMany({
      where,
      select: summary,
      orderBy: [{ startAt: query.sort }, { id: "asc" }],
      skip: (query.page - 1) * 25,
      take: 25,
    }),
    db.booking.count({ where }),
  ]);
  return { bookings, total, page: query.page, size: 25 };
}

export async function reservationDetail(actor: Actor, id: string) {
  const booking = await getPrisma().booking.findFirst({
    where: { id, venue: venueScope(actor, "calendar") },
    select: {
      ...summary,
      items: {
        select: {
          originalSlotId: true,
          startAt: true,
          endAt: true,
          unitPrice: true,
        },
        orderBy: { startAt: "asc" },
      },
      addons: {
        select: { nameSnapshot: true, quantity: true, totalPrice: true },
      },
      receipt: { select: { reference: true } },
    },
  });
  if (!booking)
    throw new AppError(404, "BOOKING_NOT_FOUND", "Booking not found.");
  return booking;
}
