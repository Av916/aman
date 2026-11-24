import type { Booking, Pitch, Prisma, Venue } from "@/generated/prisma/client";
import { refreshPitch } from "@/modules/availability/service";
import { assertTransition } from "@/modules/bookings/booking.state-machine";
import { bookingAudit } from "@/modules/bookings/booking.repository";
import { notify } from "@/modules/notifications/service";

export async function releaseLockedBooking(
  tx: Prisma.TransactionClient,
  booking: Booking,
  pitch: Pitch,
  venue: Venue,
  status: "EXPIRED" | "CANCELLED",
  now: Date,
) {
  assertTransition(booking.status, status);
  const updated = await tx.booking.update({
    where: { id: booking.id },
    data: {
      status,
      ...(status === "CANCELLED"
        ? {
            cancelledAt: now,
            cancellationReason: "Customer released the unpaid hold.",
          }
        : {}),
    },
  });
  const released = await tx.slot.updateMany({
    where: { pitchId: pitch.id, activeBookingId: booking.id, status: "HELD" },
    data: { status: "AVAILABLE", activeBookingId: null, holdExpiresAt: null },
  });
  await tx.couponRedemption.updateMany({
    where: { bookingId: booking.id, status: "RESERVED" },
    data: { status: "RELEASED" },
  });
  await tx.rescheduleRequest.updateMany({
    where: { replacementBookingId: booking.id, status: "AWAITING_PAYMENT" },
    data: { status: status === "EXPIRED" ? "EXPIRED" : "CANCELLED" },
  });
  if (released.count) await refreshPitch(tx, pitch, venue, false, now);
  await bookingAudit(
    tx,
    booking,
    status === "EXPIRED" ? "BOOKING_EXPIRED" : "BOOKING_HOLD_RELEASED",
    { released: released.count },
  );
  if (status === "EXPIRED") await notify(tx, booking, "RESERVATION_EXPIRED");
  return updated;
}
