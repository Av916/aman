BEGIN;

ALTER TABLE "Booking" DROP CONSTRAINT "Booking_confirmed_payment_check";
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_customer_identity_check"
  CHECK (num_nonnulls("customerId", "guestCustomerId") = 1 AND
    ("bookingSource" <> 'ONLINE' OR "customerId" IS NOT NULL));
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_confirmation_check"
  CHECK (("status" NOT IN ('CONFIRMED','CHECKED_IN','COMPLETED','NO_SHOW','RESCHEDULED') OR "confirmedAt" IS NOT NULL)
    AND ("confirmedPaymentId" IS NULL OR "confirmedAt" IS NOT NULL)
    AND ("settlementDue" IS NULL OR ("settlementDue" >= 0 AND "settlementDue" <= "totalAmount")));
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_provider_order_check"
  CHECK (("provider" = 'RAZORPAY') = ("orderId" IS NOT NULL));
ALTER TABLE "CancellationRequest" ADD CHECK ("refundAmount" >= 0);
ALTER TABLE "CancellationPolicyRule" ADD CHECK ("refundPercentage" BETWEEN 0 AND 100 AND "minimumHoursBeforeBooking" >= 0);
CREATE UNIQUE INDEX "CancellationPolicy_active_venue_key" ON "CancellationPolicy" ("venueId") WHERE "isActive";
ALTER TABLE "Review" ADD CHECK ("rating" BETWEEN 1 AND 5);
ALTER TABLE "Coupon" ADD CHECK ("discountValue" > 0 AND "minimumBookingAmount" >= 0 AND "startsAt" < "expiresAt"
  AND ("discountType" <> 'PERCENTAGE' OR "discountValue" <= 100)
  AND ("maximumDiscount" IS NULL OR "maximumDiscount" > 0)
  AND ("usageLimit" IS NULL OR "usageLimit" > 0)
  AND ("usageLimitPerCustomer" IS NULL OR "usageLimitPerCustomer" > 0));
ALTER TABLE "CouponRedemption" ADD CHECK ("discountAmount" > 0);
ALTER TABLE "FinancialTransaction" ADD CHECK ("amount" > 0);
ALTER TABLE "PaymentAllocation" ADD CHECK ("amount" > 0);
UPDATE "Refund" SET "sourceKey" = 'compensation:' || "paymentId"::text WHERE "sourceKey" IS NULL;

INSERT INTO "FinancialTransaction" (id, "venueId", "bookingId", "paymentId", "transactionType", amount, currency, reference, "occurredAt")
SELECT gen_random_uuid(), b."venueId", b.id, p.id, 'PAYMENT_CAPTURE', p.amount, p.currency, 'capture:' || p.id, p."paidAt"
FROM "Payment" p JOIN "Booking" b ON b.id = p."bookingId" WHERE p."paidAt" IS NOT NULL
ON CONFLICT (reference) DO NOTHING;
INSERT INTO "FinancialTransaction" (id, "venueId", "bookingId", "paymentId", "refundId", "transactionType", amount, currency, reference, "occurredAt")
SELECT gen_random_uuid(), b."venueId", b.id, r."paymentId", r.id, 'REFUND', r.amount, p.currency, 'refund:' || r.id, r."processedAt"
FROM "Refund" r JOIN "Booking" b ON b.id = r."bookingId" JOIN "Payment" p ON p.id = r."paymentId"
WHERE r.status = 'PROCESSED' AND r."processedAt" IS NOT NULL
ON CONFLICT (reference) DO NOTHING;
INSERT INTO "FinancialTransaction" (id, "venueId", "bookingId", "paymentId", "transactionType", amount, currency, reference, "occurredAt")
SELECT gen_random_uuid(), "venueId", id, "confirmedPaymentId", charge.kind::"TransactionType", charge.amount, currency,
       charge.prefix || id, "confirmedAt"
FROM "Booking" CROSS JOIN LATERAL (VALUES ('PLATFORM_FEE', "platformFee", 'fee:'), ('TAX', "taxAmount", 'tax:')) AS charge(kind, amount, prefix)
WHERE "confirmedPaymentId" IS NOT NULL AND charge.amount > 0
ON CONFLICT (reference) DO NOTHING;

CREATE FUNCTION pitchmate_refund_balance() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE captured integer;
BEGIN
  SELECT amount INTO captured FROM "Payment" WHERE id = NEW."paymentId" AND "paidAt" IS NOT NULL FOR NO KEY UPDATE;
  IF captured IS NULL OR NEW.amount + COALESCE((SELECT SUM(amount) FROM "Refund"
    WHERE "paymentId" = NEW."paymentId" AND id <> NEW.id), 0) > captured THEN
    RAISE EXCEPTION 'Refund exceeds captured payment balance' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "Refund_balance_guard" BEFORE INSERT OR UPDATE OF amount, "paymentId" ON "Refund"
FOR EACH ROW EXECUTE FUNCTION pitchmate_refund_balance();

CREATE FUNCTION pitchmate_keep_ledger() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Financial records are append-only' USING ERRCODE = '23514';
END;
$$;
CREATE TRIGGER "FinancialTransaction_immutable" BEFORE UPDATE OR DELETE ON "FinancialTransaction"
FOR EACH ROW EXECUTE FUNCTION pitchmate_keep_ledger();

COMMIT;
