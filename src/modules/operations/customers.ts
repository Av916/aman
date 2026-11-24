import { getPrisma } from "@/lib/prisma";
import { AppError } from "@/lib/api";
import { type Actor, venueScope } from "@/modules/permissions/operations";
import type { OperationQuery } from "./queries";

export async function customers(
  actor: Actor,
  query: OperationQuery,
  id?: string,
) {
  const db = getPrisma();
  const where = {
    venueId: query.venueId,
    venue: venueScope(actor, "customers"),
    OR: id ? [{ customerId: id }, { guestCustomerId: id }] : undefined,
    customerName: query.search
      ? { contains: query.search, mode: "insensitive" as const }
      : undefined,
  };
  if (!id) {
    const [registered, guests] = await Promise.all([
      db.booking.groupBy({
        by: ["customerId", "customerName"],
        where: { ...where, customerId: { not: null } },
        _count: true,
        _max: { startAt: true },
        orderBy: [{ _max: { startAt: "desc" } }, { customerId: "asc" }],
        take: 25,
        skip: (query.page - 1) * 25,
      }),
      db.booking.groupBy({
        by: ["guestCustomerId", "customerName"],
        where: { ...where, guestCustomerId: { not: null } },
        _count: true,
        _max: { startAt: true },
        orderBy: [{ _max: { startAt: "desc" } }, { guestCustomerId: "asc" }],
        take: 25,
        skip: (query.page - 1) * 25,
      }),
    ]);
    return {
      customers: [
        ...registered.map((row) => ({
          ...row,
          id: row.customerId!,
          type: "Registered",
        })),
        ...guests.map((row) => ({
          ...row,
          id: row.guestCustomerId!,
          type: "Guest",
        })),
      ],
      page: query.page,
    };
  }
  const [bookings, groups, money] = await Promise.all([
    db.booking.findMany({
      where,
      orderBy: { startAt: "desc" },
      take: 25,
      skip: (query.page - 1) * 25,
      select: {
        id: true,
        bookingNumber: true,
        customerName: true,
        customerEmail: true,
        customerPhone: true,
        startAt: true,
        venueName: true,
        pitchName: true,
        status: true,
        totalAmount: true,
        timezone: true,
      },
    }),
    db.booking.groupBy({ by: ["status"], where, _count: true }),
    db.payment.groupBy({
      by: ["status"],
      where: { booking: where, paidAt: { not: null } },
      _sum: { amount: true },
    }),
  ]);
  if (!groups.length)
    throw new AppError(
      404,
      "CUSTOMER_NOT_FOUND",
      "Customer not found at an assigned venue.",
    );
  const refund = await db.refund.aggregate({
    where: { booking: where, status: "PROCESSED" },
    _sum: { amount: true },
  });
  return {
    bookings,
    groups,
    spending:
      money.reduce((sum, row) => sum + (row._sum.amount ?? 0), 0) -
      (refund._sum.amount ?? 0),
  };
}
