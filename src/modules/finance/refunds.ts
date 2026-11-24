import type {
  Booking,
  Payment,
  Prisma,
  Refund,
} from "@/generated/prisma/client";
import { AppError } from "@/lib/api";
import { enqueue, notify } from "@/modules/notifications/service";
import { postLedger } from "./ledger";

export async function reservedRefunds(
  tx: Prisma.TransactionClient,
  paymentId: string,
) {
  const result = await tx.refund.aggregate({
    where: { paymentId },
    _sum: { amount: true },
  });
  return result._sum.amount ?? 0;
}

// Callers hold the payment's booking lock before changing any refund reservation.
export async function reserveRefund(
  tx: Prisma.TransactionClient,
  booking: Booking,
  payment: Payment,
  sourceKey: string,
  amount: number,
  reason: string,
  allowAllocation = false,
) {
  const existing = await tx.refund.findUnique({ where: { sourceKey } });
  if (existing) {
    if (
      existing.paymentId !== payment.id ||
      existing.amount !== amount ||
      existing.reason !== reason
    )
      throw new AppError(
        409,
        "IDEMPOTENCY_MISMATCH",
        "This refund key already has different details.",
      );
    return existing;
  }
  const allocation = allowAllocation
    ? await tx.paymentAllocation.findUnique({
        where: {
          bookingId_paymentId: { bookingId: booking.id, paymentId: payment.id },
        },
      })
    : null;
  if (
    !payment.paidAt ||
    (booking.id !== payment.bookingId &&
      (!allocation || amount > allocation.amount)) ||
    amount < 1 ||
    amount > payment.amount - (await reservedRefunds(tx, payment.id))
  )
    throw new AppError(
      409,
      "REFUND_BALANCE",
      "This payment has insufficient refundable balance.",
    );
  const refund = await tx.refund.create({
    data: {
      bookingId: booking.id,
      paymentId: payment.id,
      sourceKey,
      amount,
      reason,
    },
  });
  if (payment.provider === "RAZORPAY")
    await enqueue(tx, "COMPENSATING_REFUND", refund.id, `refund:${refund.id}`);
  await tx.payment.update({
    where: { id: payment.id },
    data: { status: "REFUND_PENDING" },
  });
  await notify(tx, booking, "REFUND_INITIATED", refund.id);
  return refund;
}

export async function postProcessedRefund(
  tx: Prisma.TransactionClient,
  booking: Booking,
  refund: Refund,
  now: Date,
) {
  const payment = await tx.payment.findUniqueOrThrow({
    where: { id: refund.paymentId },
  });
  const refunds = await tx.refund.groupBy({
    by: ["status"],
    where: { paymentId: payment.id },
    _sum: { amount: true },
  });
  const processed =
    refunds.find((row) => row.status === "PROCESSED")?._sum.amount ?? 0;
  const pending = refunds.some(
    (row) => row.status === "PENDING" || row.status === "PROCESSING",
  );
  await tx.payment.update({
    where: { id: payment.id },
    data: {
      status:
        processed === payment.amount
          ? "REFUNDED"
          : pending
            ? "REFUND_PENDING"
            : "PARTIALLY_REFUNDED",
    },
  });
  await postLedger(tx, { ...booking, currency: payment.currency }, [
    {
      reference: `refund:${refund.id}`,
      transactionType: "REFUND",
      amount: refund.amount,
      occurredAt: now,
      paymentId: payment.id,
      refundId: refund.id,
    },
  ]);
  await notify(tx, booking, "REFUND_PROCESSED", refund.id);
}
