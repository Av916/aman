import { z } from "zod";
import { getPrisma } from "@/lib/prisma";
import { AppError } from "@/lib/api";
import {
  operationRange,
  paymentFilter,
  operationVenues,
  type OperationQuery,
} from "@/modules/operations/queries";
import { venueScope, type Actor } from "@/modules/permissions/operations";
import { analytics } from "./analytics";
import type { Prisma } from "@/generated/prisma/client";

export const reportKind = z.enum([
  "bookings",
  "revenue",
  "payments",
  "refunds",
  "occupancy",
  "cancellations",
  "customers",
  "pitches",
]);
const rowLimit = 5000;
export const csvCell = (value: string | number | null | undefined) => {
  const text = String(value ?? "");
  const escaped =
    typeof value === "string" && /^[\s]*[=+\-@]|^[\t\r\n]/u.test(text)
      ? "'" + text
      : text;
  return '"' + escaped.replaceAll('"', '""') + '"';
};

export async function reportRows(
  actor: Actor,
  kind: z.infer<typeof reportKind>,
  query: OperationQuery,
) {
  const db = getPrisma();
  const venues = await operationVenues(actor, "finance");
  if (!venues.length && actor.role !== "ADMIN")
    throw new AppError(
      403,
      "FORBIDDEN",
      "Reporting requires access to an assigned venue.",
    );
  if (query.venueId && !venues.some((venue) => venue.id === query.venueId))
    throw new AppError(404, "VENUE_NOT_FOUND", "Venue not found.");
  if (["revenue", "occupancy", "pitches"].includes(kind)) {
    const { venues } = await analytics(actor, query);
    if (kind === "pitches")
      return [
        [
          "Venue",
          "Pitch",
          "Net collected (paise)",
          "Booked minutes",
          "Sellable minutes",
          "Occupancy percent",
        ],
        ...venues.flatMap((venue) =>
          venue.pitches.map((row) => [
            venue.name,
            row.name,
            venue.pitchMoney.find((pitch) => pitch.id === row.id)?.amount ?? 0,
            row.booked,
            row.sellable,
            row.rate,
          ]),
        ),
      ];
    if (kind === "revenue")
      return [
        ["Venue", "Day", "Transaction type", "Paise"],
        ...venues.flatMap((venue) =>
          venue.timeline.map((row) => [
            venue.name,
            row.day,
            row.type,
            row.amount,
          ]),
        ),
      ];
    return [
      [
        "Venue",
        "Pitch",
        "Booked minutes",
        "Sellable minutes",
        "Occupancy percent",
      ],
      ...venues.flatMap((venue) =>
        venue.pitches.map((row) => [
          venue.name,
          row.name,
          row.booked,
          row.sellable,
          row.rate,
        ]),
      ),
    ];
  }
  const where: Prisma.BookingWhereInput = {
    venue: venueScope(actor, "finance"),
    venueId: query.venueId,
    pitchId: query.pitchId,
    status: query.status,
    AND: [paymentFilter(query.payment)],
  };
  const rangeFor = (timezone: string) => operationRange(query, timezone, 30);
  const dateScopes = venues
    .filter((venue) => !query.venueId || venue.id === query.venueId)
    .map(({ id, timezone }) => {
      const range = rangeFor(timezone);
      return { venueId: id, from: range.from, to: range.to };
    });
  if (kind === "payments" || kind === "refunds") {
    const shared = {
      booking: where,
      take: rowLimit + 1,
    };
    if (kind === "payments") {
      const data = await db.payment.findMany({
        where: {
          booking: shared.booking,
          OR: dateScopes.map(({ venueId, from, to }) => ({
            booking: { venueId },
            createdAt: { gte: from, lt: to },
          })),
        },
        take: shared.take,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          provider: true,
          paymentMethod: true,
          amount: true,
          status: true,
          createdAt: true,
          booking: {
            select: { timezone: true, bookingNumber: true, venueName: true },
          },
        },
      });
      return [
        [
          "Payment",
          "Booking",
          "Venue",
          "Provider",
          "Method",
          "Paise",
          "Status",
          "Local created time",
        ],
        ...data.map((row) => [
          row.id,
          row.booking.bookingNumber,
          row.booking.venueName,
          row.provider,
          row.paymentMethod,
          row.amount,
          row.status,
          localTime(row.createdAt, row.booking.timezone),
        ]),
      ];
    }
    const data = await db.refund.findMany({
      where: {
        booking: shared.booking,
        OR: dateScopes.map(({ venueId, from, to }) => ({
          booking: { venueId },
          createdAt: { gte: from, lt: to },
        })),
      },
      take: shared.take,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        amount: true,
        status: true,
        createdAt: true,
        processedAt: true,
        booking: {
          select: { timezone: true, bookingNumber: true, venueName: true },
        },
      },
    });
    return [
      [
        "Refund",
        "Booking",
        "Venue",
        "Paise",
        "Status",
        "Requested",
        "Processed",
      ],
      ...data.map((row) => [
        row.id,
        row.booking.bookingNumber,
        row.booking.venueName,
        row.amount,
        row.status,
        localTime(row.createdAt, row.booking.timezone),
        row.processedAt
          ? localTime(row.processedAt, row.booking.timezone)
          : null,
      ]),
    ];
  }
  if (kind === "customers")
    where.AND = [
      paymentFilter(query.payment),
      { venue: venueScope(actor, "customers") },
    ];
  const data = await db.booking.findMany({
    where: {
      ...where,
      ...(kind === "cancellations" ? { status: "CANCELLED" } : {}),
      OR: dateScopes.map(({ venueId, from, to }) => ({
        venueId,
        startAt: { gte: from, lt: to },
      })),
    },
    take: rowLimit + 1,
    orderBy: { startAt: "desc" },
    select: {
      bookingNumber: true,
      venueName: true,
      pitchName: true,
      timezone: true,
      startAt: true,
      status: true,
      bookingSource: true,
      totalAmount: true,
      customerName: kind === "customers",
      cancellationReason: kind === "cancellations",
    },
  });
  return [
    [
      "Booking",
      "Venue",
      "Pitch",
      "Local start",
      "Status",
      "Source",
      "Paise",
      ...(kind === "customers"
        ? ["Customer"]
        : kind === "cancellations"
          ? ["Reason"]
          : []),
    ],
    ...data.map((row) => [
      row.bookingNumber,
      row.venueName,
      row.pitchName,
      localTime(row.startAt, row.timezone),
      row.status,
      row.bookingSource,
      row.totalAmount,
      ...(kind === "customers"
        ? [row.customerName]
        : kind === "cancellations"
          ? [row.cancellationReason]
          : []),
    ]),
  ];
}

const localTime = (date: Date, timezone: string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    dateStyle: "short",
    timeStyle: "short",
    hourCycle: "h23",
  }).format(date);

export async function csvReport(
  actor: Actor,
  kind: z.infer<typeof reportKind>,
  query: OperationQuery,
) {
  const list = await reportRows(actor, kind, query);
  if (list.length > rowLimit + 1)
    throw new AppError(
      422,
      "EXPORT_TOO_LARGE",
      "Narrow the selected date range or venue before exporting.",
    );
  await getPrisma().auditLog.create({
    data: {
      actorId: actor.id,
      action: "REPORT_EXPORTED",
      entityType: "Report",
      entityId: kind,
      metadata: {
        venueId: query.venueId ?? null,
        from: query.from ?? null,
        to: query.to ?? null,
        rows: list.length - 1,
      },
    },
  });
  return list.map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
