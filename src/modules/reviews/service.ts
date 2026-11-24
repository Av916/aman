import { z } from "zod";
import { AppError } from "@/lib/api";
import { getPrisma } from "@/lib/prisma";
import {
  bookingAudit,
  lockBooking,
  transaction,
} from "@/modules/bookings/booking.repository";
import {
  requireVenueWrite,
  type Actor,
} from "@/modules/permissions/operations";
import { notify } from "@/modules/notifications/service";

export const reviewInput = z.strictObject({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1200).optional(),
});
export const reasonInput = z.string().trim().min(5).max(300);
const editDays = 14;

export async function publicReviews(slug: string, page = 1) {
  const db = getPrisma();
  const venue = await db.venue.findFirst({
    where: {
      slug,
      status: "APPROVED",
      publishedAt: { not: null },
      deletedAt: null,
    },
    select: { id: true },
  });
  if (!venue) throw new AppError(404, "VENUE_NOT_FOUND", "Venue not found.");
  const where = { venueId: venue.id, status: "PUBLISHED" as const };
  const [reviews, aggregates] = await Promise.all([
    db.review.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      take: 12,
      skip: (page - 1) * 12,
      select: {
        id: true,
        rating: true,
        comment: true,
        ownerResponse: true,
        ownerRespondedAt: true,
        createdAt: true,
      },
    }),
    db.review.groupBy({ by: ["rating"], where, _count: true }),
  ]);
  const total = aggregates.reduce((sum, row) => sum + row._count, 0);
  return {
    reviews,
    total,
    average: total
      ? aggregates.reduce((sum, row) => sum + row._count * row.rating, 0) /
        total
      : null,
    distribution: aggregates,
  };
}

export function submitReview(
  actor: Actor,
  bookingId: string,
  input: z.output<typeof reviewInput>,
) {
  return transaction(async (tx) => {
    const { booking } = await lockBooking(tx, bookingId, actor.id);
    if (booking.status !== "COMPLETED")
      throw new AppError(
        409,
        "REVIEW_NOT_ELIGIBLE",
        "Only completed bookings can be reviewed.",
      );
    const review = await tx.review.create({
      data: {
        ...input,
        bookingId,
        customerId: actor.id,
        venueId: booking.venueId,
        pitchId: booking.pitchId,
      },
    });
    await bookingAudit(
      tx,
      booking,
      "BOOKING_REVIEW_SUBMITTED",
      { reviewId: review.id },
      actor.id,
    );
    return review;
  });
}

export async function editReview(
  actor: Actor,
  id: string,
  input: z.output<typeof reviewInput>,
) {
  const db = getPrisma();
  const result = await db.review.updateMany({
    where: {
      id,
      customerId: actor.id,
      status: "PUBLISHED",
      createdAt: { gte: new Date(Date.now() - editDays * 86400_000) },
    },
    data: { rating: input.rating, comment: input.comment ?? null },
  });
  if (!result.count)
    throw new AppError(
      404,
      "REVIEW_NOT_EDITABLE",
      "This review cannot be edited.",
    );
  return result;
}

export async function reportReview(actor: Actor, id: string, reason: string) {
  const db = getPrisma();
  const row = await db.review.findFirst({ where: { id, status: "PUBLISHED" } });
  if (!row) throw new AppError(404, "REVIEW_NOT_FOUND", "Review not found.");
  return db.reviewReport.upsert({
    where: { reviewId_userId: { reviewId: id, userId: actor.id } },
    update: {},
    create: { reviewId: id, userId: actor.id, reason },
  });
}

export function respondReview(actor: Actor, id: string, response: string) {
  return transaction(async (tx) => {
    const review = await tx.review.findUniqueOrThrow({
      where: { id },
      include: { booking: true },
    });
    await requireVenueWrite(tx, actor, review.venueId, "reviews");
    if (review.status !== "PUBLISHED")
      throw new AppError(
        409,
        "REVIEW_NOT_PUBLISHED",
        "Only published reviews can receive a reply.",
      );
    const saved = await tx.review.update({
      where: { id },
      data: { ownerResponse: response, ownerRespondedAt: new Date() },
    });
    await bookingAudit(
      tx,
      review.booking,
      "REVIEW_RESPONSE_SAVED",
      { reviewId: id },
      actor.id,
    );
    await notify(tx, review.booking, "REVIEW_RESPONSE", id);
    return saved;
  });
}

export function moderateReview(
  actor: Actor,
  id: string,
  status: "PUBLISHED" | "HIDDEN" | "REJECTED",
  reason: string,
) {
  if (actor.role !== "ADMIN")
    throw new AppError(403, "FORBIDDEN", "Administrator access is required.");
  return transaction(async (tx) => {
    const result = await tx.review.update({ where: { id }, data: { status } });
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: "REVIEW_MODERATED",
        entityType: "Review",
        entityId: id,
        metadata: { status, reason },
      },
    });
    return result;
  });
}
