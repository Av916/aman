import type {
  NotificationType,
  OutboxType,
  Prisma,
} from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";

export function enqueue(
  tx: Prisma.TransactionClient,
  eventType: OutboxType,
  aggregateId: string,
  dedupeKey: string,
  payload: Prisma.InputJsonValue = {},
) {
  return tx.outboxEvent.upsert({
    where: { dedupeKey },
    update: {},
    create: { eventType, aggregateId, dedupeKey, payload },
  });
}

const copy: Record<NotificationType, [string, string]> = {
  BOOKING_CONFIRMED: ["Booking confirmed", "Your pitch is reserved."],
  PAYMENT_FAILED: [
    "Payment failed",
    "Check the booking to see whether you can retry payment.",
  ],
  RESERVATION_EXPIRED: [
    "Reservation expired",
    "Your hold ended and the slots were released.",
  ],
  REFUND_INITIATED: [
    "Refund initiated",
    "We have recorded your refund request.",
  ],
  BOOKING_CANCELLED: ["Booking cancelled", "Your reservation was cancelled."],
  CHECKED_IN: ["Checked in", "Your arrival has been recorded."],
  BOOKING_REMINDER: [
    "Upcoming booking",
    "Your pitch reservation is coming up.",
  ],
  REVIEW_RESPONSE: ["Venue reply", "The venue responded to your review."],
  REFUND_FAILED: [
    "Refund needs attention",
    "The refund could not be completed yet.",
  ],
  RESCHEDULED: ["Booking moved", "Your reservation has a new time."],
  REFUND_PROCESSED: [
    "Refund processed",
    "Your refund has been recorded as processed.",
  ],
};

export async function notify(
  tx: Prisma.TransactionClient,
  booking: {
    id: string;
    customerId: string | null;
    customerEmail?: string | null;
    bookingNumber: string;
    customerName: string;
  },
  type: NotificationType,
  suffix = "",
) {
  const dedupeKey = `${booking.id}:${type}:${suffix}`;
  const [title, message] = copy[type];
  if (!booking.customerId) {
    if (booking.customerEmail)
      await queueOperationalEmail(
        tx,
        booking.id,
        dedupeKey,
        booking.customerEmail,
        title,
        `${booking.bookingNumber}. ${message}`,
      );
    return;
  }
  const notification = await tx.notification.upsert({
    where: { dedupeKey },
    update: {},
    create: {
      bookingId: booking.id,
      userId: booking.customerId,
      dedupeKey,
      type,
      title,
      message: `${booking.bookingNumber}. ${message}`,
    },
  });
  await enqueue(tx, "BOOKING_EMAIL", notification.id, `email:${dedupeKey}`, {
    customerName: booking.customerName,
  });
  return notification;
}

export function queueOperationalEmail(
  tx: Prisma.TransactionClient,
  id: string,
  key: string,
  to: string,
  title: string,
  text: string,
) {
  return enqueue(tx, "OPERATIONAL_EMAIL", id, `email:${key}`, {
    to,
    title,
    text,
  });
}

export const unreadCount = (userId: string) =>
  getPrisma().notification.count({ where: { userId, readAt: null } });
export const readNotifications = (userId: string, id?: string) =>
  getPrisma().notification.updateMany({
    where: { userId, id, readAt: null },
    data: { readAt: new Date() },
  });
export const notificationList = (userId: string, page = 1) =>
  getPrisma().notification.findMany({
    where: { userId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 25,
    skip: (page - 1) * 25,
  });
