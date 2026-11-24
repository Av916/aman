import { getPrisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { lockVenue, lockPitch } from "@/modules/venues/venue.repository";
import { bookingMissing } from "./booking.state-machine";

export function transaction<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
) {
  async function attempt(): Promise<T> {
    for (let retry = 0; ; retry++) {
      try {
        return await getPrisma().$transaction(fn, {
          maxWait: 15_000,
          timeout: 20_000,
        });
      } catch (error) {
        if (
          retry >= 2 ||
          !(error instanceof Prisma.PrismaClientKnownRequestError) ||
          error.code !== "P2034"
        )
          throw error;
        await new Promise((resolve) => setTimeout(resolve, 20 * (retry + 1)));
      }
    }
  }
  return attempt();
}

export async function lockBooking(
  tx: Prisma.TransactionClient,
  id: string,
  customerId?: string,
) {
  const row = await tx.booking.findFirst({
    where: { id, customerId },
    select: { venueId: true, pitchId: true },
  });
  if (!row) throw bookingMissing();
  const venue = await lockVenue(tx, row.venueId);
  const pitch = await lockPitch(tx, row.pitchId);
  await tx.$queryRaw`SELECT id FROM "Booking" WHERE id = ${id}::uuid FOR UPDATE`;
  const booking = await tx.booking.findUniqueOrThrow({ where: { id } });
  return { booking, pitch, venue };
}

const viewInclude = {
  items: { orderBy: { startAt: "asc" } },
  addons: { orderBy: { nameSnapshot: "asc" } },
  venue: {
    select: {
      slug: true,
      images: {
        select: { imageUrl: true, altText: true },
        orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }],
        take: 1,
      },
    },
  },
  pitch: { select: { capacity: true } },
  confirmedPayment: {
    select: {
      providerPaymentId: true,
      paymentMethod: true,
      status: true,
      paidAt: true,
    },
  },
  payments: {
    select: { id: true, status: true },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 1,
  },
  refunds: {
    select: { id: true, amount: true, status: true, reason: true },
    orderBy: { createdAt: "desc" },
  },
  receipt: { select: { reference: true } },
  review: { select: { id: true, rating: true, comment: true, status: true } },
  allocations: { select: { amount: true } },
  replacements: {
    select: { id: true, bookingNumber: true },
    where: { status: { notIn: ["EXPIRED", "CANCELLED"] } },
    orderBy: { createdAt: "desc" },
    take: 1,
  },
} satisfies Prisma.BookingInclude;

const privateBookingFields = {
  internalNotes: true,
  createdById: true,
  checkedInById: true,
  guestCustomerId: true,
} satisfies Prisma.BookingOmit;

export type BookingView = Prisma.BookingGetPayload<{
  include: typeof viewInclude;
  omit: typeof privateBookingFields;
}>;

export async function bookingView(id: string, customerId: string) {
  const result = await getPrisma().booking.findFirst({
    where: { id, customerId },
    include: viewInclude,
    omit: privateBookingFields,
  });
  if (!result) throw bookingMissing();
  return result;
}

export function bookingAudit(
  tx: Prisma.TransactionClient,
  booking: {
    id: string;
    customerId: string | null;
    createdById?: string | null;
  },
  action: string,
  metadata?: Prisma.InputJsonValue,
  actorId = booking.createdById ?? booking.customerId,
) {
  return tx.auditLog.create({
    data: {
      actorId,
      action,
      entityType: "Booking",
      entityId: booking.id,
      metadata,
    },
  });
}

export async function bookingList(
  customerId: string,
  status: BookingView["status"],
  page: number,
) {
  const size = 12;
  const where = { customerId, status };
  const db = getPrisma();
  const items = await db.booking.findMany({
    where,
    include: viewInclude,
    omit: privateBookingFields,
    orderBy: [
      { startAt: status === "CONFIRMED" ? "asc" : "desc" },
      { id: "desc" },
    ],
    skip: (page - 1) * size,
    take: size,
  });
  const total = await db.booking.count({ where });
  return {
    bookings: items,
    pagination: { page, size, total, pages: Math.ceil(total / size) },
  };
}
