-- Use the pitch- and booking-scoped references as the canonical foreign keys.
-- Both stronger references already exist from the preceding migration.
ALTER TABLE "Slot" DROP CONSTRAINT "Slot_activeBookingId_fkey";
ALTER TABLE "Booking" DROP CONSTRAINT "Booking_confirmedPaymentId_fkey";

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "Slot" WHERE ("status" IN ('HELD','BOOKED') AND "activeBookingId" IS NULL)
      OR ("status" IN ('AVAILABLE','BLOCKED') AND "holdExpiresAt" IS NOT NULL)
  ) THEN
    ALTER TABLE "Slot" VALIDATE CONSTRAINT "Slot_booking_ownership_check";
  END IF;
END $$;
