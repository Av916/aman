import { getPrisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import {
  operationRange,
  operationVenues,
  type OperationQuery,
} from "@/modules/operations/queries";
import {
  type Actor,
  requireVenueAccess,
} from "@/modules/permissions/operations";
import { localDay } from "@/modules/schedules/time";

export function occupancyRate(booked: number, sellable: number) {
  return sellable ? Math.round((booked * 10000) / sellable) / 100 : 0;
}

const numbers = (rows: { kind: string; amount: bigint | number }[]) =>
  Object.fromEntries(rows.map(({ kind, amount }) => [kind, Number(amount)]));

export async function analytics(actor: Actor, query: OperationQuery) {
  const db = getPrisma();
  const venues = query.venueId
    ? [await requireVenueAccess(db, actor, query.venueId, "finance")]
    : await operationVenues(actor, "finance");
  const reports = await Promise.all(
    venues.map(async ({ id, name, timezone }) => {
      const now = new Date();
      const day = localDay(now, timezone);
      const today = operationRange({ from: day, to: day }, timezone, 1);
      const month = operationRange(
        { from: day.slice(0, 7) + "-01", to: day },
        timezone,
        1,
      );
      const range =
        query.from || query.to ? operationRange(query, timezone, 1) : month;
      const pitch = query.pitchId
        ? Prisma.sql`AND b."pitchId" = ${query.pitchId}::uuid`
        : Prisma.empty;
      const slotPitch = query.pitchId
        ? Prisma.sql`AND s."pitchId" = ${query.pitchId}::uuid`
        : Prisma.empty;
      const bookingWhere = { venueId: id, pitchId: query.pitchId };
      const [
        ledger,
        occupancy,
        groups,
        timeline,
        recent,
        counts,
        refunds,
        gmv,
        outstanding,
      ] = await Promise.all([
        db.$queryRaw<
          {
            kind: string;
            amount: bigint;
            today: bigint | null;
            month: bigint | null;
          }[]
        >`
        SELECT f."transactionType"::text AS kind,
          COALESCE(SUM(f.amount) FILTER (WHERE f."occurredAt" >= ${range.from} AND f."occurredAt" < ${range.to}), 0) AS amount,
          SUM(f.amount) FILTER (WHERE f."occurredAt" >= ${today.from} AND f."occurredAt" < ${today.to}) AS today,
          SUM(f.amount) FILTER (WHERE f."occurredAt" >= ${month.from} AND f."occurredAt" < ${month.to}) AS month
        FROM "FinancialTransaction" f JOIN "Booking" b ON b.id = f."bookingId"
        WHERE f."venueId" = ${id}::uuid AND f.currency = 'INR' ${pitch}
        AND f."occurredAt" >= ${new Date(Math.min(+range.from, +month.from))}
        AND f."occurredAt" < ${new Date(Math.max(+range.to, +month.to))}
        GROUP BY f."transactionType"`,
        db.$queryRaw<
          { pitchId: string; name: string; book: bigint; sell: bigint }[]
        >`
        SELECT p.id AS "pitchId", p.name, COALESCE(SUM(EXTRACT(EPOCH FROM (LEAST(s."endAt", ${range.to}) - GREATEST(s."startAt", ${range.from}))) / 60)
          FILTER (WHERE b.status IN ('CONFIRMED', 'CHECKED_IN', 'COMPLETED', 'NO_SHOW')),0)::bigint AS book,
          COALESCE(SUM(EXTRACT(EPOCH FROM (LEAST(s."endAt", ${range.to}) - GREATEST(s."startAt", ${range.from}))) / 60),0)::bigint AS sell
        FROM "Slot" s JOIN "Pitch" p ON p.id = s."pitchId"
        LEFT JOIN "Booking" b ON b.id = s."activeBookingId"
        WHERE p."venueId" = ${id}::uuid AND s."startAt" < ${range.to} AND s."endAt" > ${range.from} AND s.status <> 'BLOCKED' ${slotPitch}
        GROUP BY p.id, p.name ORDER BY p.name`,
        db.booking.groupBy({
          by: ["status", "bookingSource"],
          where: {
            ...bookingWhere,
            startAt: { gte: range.from, lt: range.to },
          },
          _count: true,
          _avg: { durationMinutes: true, totalAmount: true },
        }),
        db.$queryRaw<{ day: string; type: string; amount: bigint }[]>`
        SELECT to_char(f."occurredAt" AT TIME ZONE ${timezone}, 'YYYY-MM-DD') AS day, f."transactionType"::text AS type, SUM(f.amount) AS amount
        FROM "FinancialTransaction" f JOIN "Booking" b ON b.id = f."bookingId"
        WHERE f."venueId" = ${id}::uuid AND f.currency = 'INR' AND f."occurredAt" >= ${range.from} AND f."occurredAt" < ${range.to} ${pitch}
        GROUP BY 1, 2 ORDER BY 1`,
        db.booking.findMany({
          where: {
            ...bookingWhere,
            startAt: { gte: today.from, lt: today.to },
          },
          orderBy: { startAt: "asc" },
          take: 20,
          select: {
            id: true,
            bookingNumber: true,
            pitchName: true,
            customerName: true,
            status: true,
            startAt: true,
            endAt: true,
          },
        }),
        db.booking.groupBy({
          by: ["status"],
          where: { ...bookingWhere, endAt: { gt: now } },
          _count: true,
        }),
        db.refund.aggregate({
          where: {
            booking: bookingWhere,
            status: { in: ["PENDING", "PROCESSING"] },
          },
          _sum: { amount: true },
          _count: true,
        }),
        db.booking.aggregate({
          where: {
            ...bookingWhere,
            confirmedAt: { not: null },
            status: { not: "RESCHEDULED" },
            startAt: { gte: range.from, lt: range.to },
          },
          _sum: { totalAmount: true },
        }),
        db.booking.aggregate({
          where: {
            ...bookingWhere,
            confirmedPaymentId: null,
            settlementDue: null,
            bookingSource: { not: "ONLINE" },
            status: { in: ["CONFIRMED", "CHECKED_IN", "COMPLETED", "NO_SHOW"] },
          },
          _sum: { totalAmount: true },
        }),
      ]);
      const [bookingDays, hourly, pitchMoney, repeat, reviews, latest] =
        await Promise.all([
          db.$queryRaw<{ day: string; status: string; count: bigint }[]>`
        SELECT to_char(b."startAt" AT TIME ZONE ${timezone}, 'YYYY-MM-DD') AS day, b.status::text AS status, COUNT(*) AS count
        FROM "Booking" b WHERE b."venueId" = ${id}::uuid AND b."startAt" >= ${range.from} AND b."startAt" < ${range.to} ${pitch}
        GROUP BY 1,2 ORDER BY 1`,
          db.$queryRaw<
            { hour: number; weekday: number; book: bigint; sell: bigint }[]
          >`
        SELECT EXTRACT(HOUR FROM s."startAt" AT TIME ZONE ${timezone})::int AS hour,
          EXTRACT(ISODOW FROM s."startAt" AT TIME ZONE ${timezone})::int AS weekday,
          COALESCE(SUM(EXTRACT(EPOCH FROM s."endAt" - s."startAt") / 60)
            FILTER (WHERE b.status IN ('CONFIRMED','CHECKED_IN','COMPLETED','NO_SHOW')),0)::bigint AS book,
          COALESCE(SUM(EXTRACT(EPOCH FROM s."endAt" - s."startAt") / 60),0)::bigint AS sell
        FROM "Slot" s JOIN "Pitch" p ON p.id = s."pitchId" LEFT JOIN "Booking" b ON b.id = s."activeBookingId"
        WHERE p."venueId" = ${id}::uuid AND s."startAt" >= ${range.from} AND s."startAt" < ${range.to}
          AND s.status <> 'BLOCKED' ${slotPitch} GROUP BY 1,2 ORDER BY 2,1`,
          db.$queryRaw<{ id: string; name: string; amount: bigint }[]>`
        SELECT p.id, p.name, SUM(CASE WHEN f."transactionType" = 'REFUND' THEN -f.amount ELSE f.amount END) AS amount
        FROM "FinancialTransaction" f JOIN "Booking" b ON b.id = f."bookingId" JOIN "Pitch" p ON p.id = b."pitchId"
        WHERE f."venueId" = ${id}::uuid AND f.currency = 'INR'
          AND f."occurredAt" >= ${range.from} AND f."occurredAt" < ${range.to}
          AND f."transactionType" IN ('PAYMENT_CAPTURE','OFFLINE_PAYMENT','REFUND') ${pitch}
        GROUP BY p.id, p.name ORDER BY 3 DESC`,
          db.$queryRaw<{ total: bigint; repeat: bigint }[]>`
        SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE visits > 1) AS repeat FROM (
          SELECT b."customerId", b."guestCustomerId", COUNT(*) AS visits
          FROM "Booking" b WHERE b."venueId" = ${id}::uuid AND b."startAt" >= ${range.from} AND b."startAt" < ${range.to}
            AND b.status IN ('CONFIRMED','CHECKED_IN','COMPLETED','NO_SHOW') ${pitch}
          GROUP BY b."customerId", b."guestCustomerId"
        ) customers`,
          db.review.findMany({
            where: { venueId: id, pitchId: query.pitchId, status: "PUBLISHED" },
            select: { id: true, rating: true, comment: true, createdAt: true },
            orderBy: { createdAt: "desc" },
            take: 5,
          }),
          db.booking.findMany({
            where: bookingWhere,
            orderBy: { createdAt: "desc" },
            take: 5,
            select: {
              id: true,
              bookingNumber: true,
              customerName: true,
              pitchName: true,
              startAt: true,
              status: true,
            },
          }),
        ]);
      const collectedTypes = ["PAYMENT_CAPTURE", "OFFLINE_PAYMENT"];
      const bookedMinutes = occupancy.reduce(
        (sum, row) => sum + Number(row.book),
        0,
      );
      const sellableMinutes = occupancy.reduce(
        (sum, row) => sum + Number(row.sell),
        0,
      );
      const revenues = numbers(ledger);
      return {
        id,
        name,
        timezone,
        range,
        todayBookings: await db.booking.count({
          where: {
            ...bookingWhere,
            startAt: { gte: today.from, lt: today.to },
            status: { in: ["CONFIRMED", "CHECKED_IN", "COMPLETED", "NO_SHOW"] },
          },
        }),
        upcomingBookings: counts
          .filter((row) => ["CONFIRMED", "CHECKED_IN"].includes(row.status))
          .reduce((sum, row) => sum + row._count, 0),
        pendingPayments:
          counts.find((row) => row.status === "PENDING_PAYMENT")?._count ?? 0,
        pendingRefunds: refunds._count,
        pendingRefundPaise: refunds._sum.amount ?? 0,
        outstanding: outstanding._sum.totalAmount ?? 0,
        grossBookingValue: gmv._sum.totalAmount ?? 0,
        todayCollected: ledger
          .filter((row) => collectedTypes.includes(row.kind))
          .reduce((sum, row) => sum + Number(row.today ?? 0), 0),
        monthCollected: ledger
          .filter((row) => collectedTypes.includes(row.kind))
          .reduce((sum, row) => sum + Number(row.month ?? 0), 0),
        netCollected:
          (revenues.PAYMENT_CAPTURE ?? 0) +
          (revenues.OFFLINE_PAYMENT ?? 0) -
          (revenues.REFUND ?? 0),
        revenues,
        groups,
        recent,
        bookedMinutes,
        sellableMinutes,
        reviews,
        latest,
        repeatCustomerRate: occupancyRate(
          Number(repeat[0]?.repeat ?? 0),
          Number(repeat[0]?.total ?? 0),
        ),
        bookingDays: bookingDays.map((row) => ({
          ...row,
          count: Number(row.count),
        })),
        hourly: hourly.map((row) => ({
          ...row,
          book: Number(row.book),
          sell: Number(row.sell),
          rate: occupancyRate(Number(row.book), Number(row.sell)),
        })),
        pitchMoney: pitchMoney.map((row) => ({
          ...row,
          amount: Number(row.amount),
        })),
        availableSlots: await db.slot.count({
          where: {
            pitch: { venueId: id },
            pitchId: query.pitchId,
            status: "AVAILABLE",
            startAt: { gte: now, lt: today.to },
          },
        }),
        occupancy: occupancyRate(bookedMinutes, sellableMinutes),
        pitches: occupancy.map((row) => ({
          id: row.pitchId,
          name: row.name,
          booked: Number(row.book),
          sellable: Number(row.sell),
          rate: occupancyRate(Number(row.book), Number(row.sell)),
        })),
        timeline: timeline.map((row) => ({
          ...row,
          amount: Number(row.amount),
        })),
      };
    }),
  );
  return { venues: reports };
}
