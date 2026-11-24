import { getPrisma } from "@/lib/prisma";

export async function auditIntegrity() {
  const db = getPrisma();
  return db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY`;
      const findings = await tx.$queryRaw<{ check: string; count: bigint }[]>`
      SELECT 'overlapping_active_bookings' AS check, count(*) FROM "Booking" a JOIN "Booking" b
        ON a."pitchId" = b."pitchId" AND a.id < b.id
        AND a."startAt" < b."endAt" AND b."startAt" < a."endAt"
        AND a.status IN ('CONFIRMED', 'CHECKED_IN') AND b.status IN ('CONFIRMED', 'CHECKED_IN')
      UNION ALL SELECT 'invalid_slot_ownership', count(*) FROM "Slot" s LEFT JOIN "Booking" b ON b.id = s."activeBookingId"
        WHERE s."startAt" >= s."endAt" OR
          (s.status IN ('HELD','BOOKED') AND (b.id IS NULL OR b."pitchId" <> s."pitchId")) OR
          (s.status IN ('AVAILABLE','BLOCKED') AND s."activeBookingId" IS NOT NULL) OR
          ((s.status = 'HELD') <> (s."holdExpiresAt" IS NOT NULL))
      UNION ALL SELECT 'unowned_active_booking_items', count(*) FROM "BookingItem" i
        JOIN "Booking" b ON b.id = i."bookingId" LEFT JOIN "Slot" s ON s.id = i."slotId"
        WHERE b.status IN ('CONFIRMED', 'CHECKED_IN') AND b."endAt" > now()
          AND (s.id IS NULL OR s."activeBookingId" IS DISTINCT FROM b.id OR s.status <> 'BOOKED')
      UNION ALL SELECT 'cross_venue_bookings', count(*) FROM "Booking" b JOIN "Pitch" p ON b."pitchId" = p.id
        WHERE p."venueId" <> b."venueId"
      UNION ALL SELECT 'cross_owner_staff_assignments', count(*) FROM "StaffVenueAssignment" a
        JOIN "StaffMember" m ON a."staffMemberId" = m.id JOIN "Venue" v ON v.id = a."venueId" WHERE v."ownerId" <> m."ownerId"
      UNION ALL SELECT 'invalid_payment_amounts', count(*) FROM "Payment" WHERE amount <= 0
      UNION ALL SELECT 'duplicate_provider_payment_references', count(*) FROM (
        SELECT "providerPaymentId" FROM "Payment" GROUP BY "providerPaymentId" HAVING count(*) > 1
      ) duplicates
      UNION ALL SELECT 'invalid_captured_refund_totals', count(*) FROM (
        SELECT p.id FROM "Payment" p JOIN "Refund" r ON r."paymentId" = p.id GROUP BY p.id
        HAVING sum(r.amount) > p.amount OR p."paidAt" IS NULL
      ) excess
      UNION ALL SELECT 'coupon_oversubscription', count(*) FROM (
        SELECT c.id FROM "Coupon" c JOIN "CouponRedemption" r ON r."couponId" = c.id
        WHERE r.status='REDEEMED' OR (r.status='RESERVED' AND r."expiresAt" > now())
        GROUP BY c.id HAVING count(*) > c."usageLimit"
        UNION ALL SELECT c.id FROM "Coupon" c JOIN "CouponRedemption" r ON r."couponId" = c.id
        WHERE r.status='REDEEMED' OR (r.status='RESERVED' AND r."expiresAt" > now())
        GROUP BY c.id, r."customerId" HAVING count(*) > c."usageLimitPerCustomer"
      ) limits
      UNION ALL SELECT 'missing_or_incorrect_capture_ledger', count(*) FROM "Payment" p
        LEFT JOIN "FinancialTransaction" f ON f.reference = 'capture:' || p.id
        WHERE p."paidAt" IS NOT NULL AND (f.id IS NULL OR f.amount <> p.amount OR f.currency <> p.currency
          OR f."bookingId" <> p."bookingId" OR f."paymentId" IS DISTINCT FROM p.id
          OR (p.provider='OFFLINE' AND f."transactionType"<>'OFFLINE_PAYMENT')
          OR (p.provider='RAZORPAY' AND f."transactionType"<>'PAYMENT_CAPTURE'))
      UNION ALL SELECT 'missing_or_incorrect_refund_ledger', count(*) FROM "Refund" r
        LEFT JOIN "FinancialTransaction" f ON f.reference = 'refund:' || r.id
        WHERE (r.status='PROCESSED' AND (f.id IS NULL OR f.amount <> r.amount OR f."bookingId" <> r."bookingId"
          OR f."refundId" IS DISTINCT FROM r.id OR f."transactionType" <> 'REFUND'))
          OR (r.status <> 'PROCESSED' AND f.id IS NOT NULL)
      UNION ALL SELECT 'online_booking_without_payment', count(*) FROM "Booking" b
        WHERE b."bookingSource"='ONLINE' AND b.status IN ('CONFIRMED','CHECKED_IN','COMPLETED','NO_SHOW')
          AND NOT EXISTS (SELECT 1 FROM "Payment" p WHERE p.id=b."confirmedPaymentId" AND p."paidAt" IS NOT NULL)
          AND COALESCE((SELECT sum(a.amount) FROM "PaymentAllocation" a WHERE a."bookingId"=b.id),0) <> b."totalAmount"
    `;
      return findings.map((row) => ({
        check: row.check,
        count: Number(row.count),
      }));
    },
    { timeout: 12_000 },
  );
}
