import type {
  Booking,
  Payment,
  Prisma,
  TransactionType,
} from "@/generated/prisma/client";

type BookingRef = Pick<Booking, "venueId" | "id" | "currency">;
type LedgerEntry = {
  reference: string;
  transactionType: TransactionType;
  amount: number;
  occurredAt: Date;
  paymentId?: string;
  refundId?: string;
};

export function postLedger(
  tx: Prisma.TransactionClient,
  booking: BookingRef,
  entries: LedgerEntry[],
) {
  return tx.financialTransaction.createMany({
    data: entries
      .filter((entry) => entry.amount > 0)
      .map((entry) => ({
        ...entry,
        venueId: booking.venueId,
        bookingId: booking.id,
        currency: booking.currency,
      })),
    skipDuplicates: true,
  });
}

export function postCapture(
  tx: Prisma.TransactionClient,
  booking: BookingRef,
  payment: Payment,
  now: Date,
) {
  return postLedger(tx, { ...booking, currency: payment.currency }, [
    {
      reference: `capture:${payment.id}`,
      transactionType:
        payment.provider === "OFFLINE" ? "OFFLINE_PAYMENT" : "PAYMENT_CAPTURE",
      amount: payment.amount,
      occurredAt: now,
      paymentId: payment.id,
    },
  ]);
}

export function postCharges(
  tx: Prisma.TransactionClient,
  booking: Booking,
  paymentId: string,
  now: Date,
) {
  return postLedger(tx, booking, [
    {
      reference: `fee:${booking.id}`,
      transactionType: "PLATFORM_FEE",
      amount: booking.platformFee,
      occurredAt: now,
      paymentId,
    },
    {
      reference: `tax:${booking.id}`,
      transactionType: "TAX",
      amount: booking.taxAmount,
      occurredAt: now,
      paymentId,
    },
  ]);
}
