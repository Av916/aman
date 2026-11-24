import { AppError } from "@/lib/api";
import type { BookingStatus } from "@/generated/prisma/enums";

const transitions: Record<BookingStatus, BookingStatus[]> = {
  PENDING_PAYMENT: ["CONFIRMED", "EXPIRED", "CANCELLED"],
  CONFIRMED: ["CHECKED_IN", "CANCELLED", "NO_SHOW", "RESCHEDULED"],
  CHECKED_IN: ["COMPLETED"],
  NO_SHOW: [],
  RESCHEDULED: [],
  EXPIRED: [],
  CANCELLED: [],
  COMPLETED: [],
};

export function assertTransition(from: BookingStatus, to: BookingStatus) {
  if (!transitions[from].includes(to))
    throw new AppError(
      409,
      "INVALID_BOOKING_TRANSITION",
      "This booking cannot enter that state.",
    );
}

export const holdExpired = (expiresAt: Date, now = new Date()) =>
  expiresAt <= now;
export const bookingMissing = () =>
  new AppError(404, "BOOKING_NOT_FOUND", "Booking not found.");
export const expired = () =>
  new AppError(
    410,
    "HOLD_EXPIRED",
    "Your hold expired. Choose available slots to start again.",
  );
export const unavailable = () =>
  new AppError(
    409,
    "SLOTS_UNAVAILABLE",
    "One or more slots changed or are unavailable. Refresh availability and choose again.",
  );
