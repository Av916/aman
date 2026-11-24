import { postProcessedRefund } from "@/modules/finance/refunds";
import { getPrisma } from "@/lib/prisma";
import { AppError } from "@/lib/api";
import {
  bookingAudit,
  lockBooking,
  transaction,
} from "@/modules/bookings/booking.repository";
import { notify } from "@/modules/notifications/service";
import { paymentGateway } from "./razorpay.provider";
import type { PaymentGateway, ProviderRefund } from "./payment.provider";

export async function recordRefund(id: string, snapshot: ProviderRefund) {
  return transaction(async (tx) => {
    const pending = await tx.refund.findUniqueOrThrow({
      where: { id },
      include: { payment: { select: { providerPaymentId: true } } },
    });
    const { booking } = await lockBooking(tx, pending.bookingId);
    const refund = await tx.refund.findUniqueOrThrow({ where: { id } });
    if (
      snapshot.payment_id !== pending.payment.providerPaymentId ||
      snapshot.amount !== refund.amount ||
      (refund.providerRefundId
        ? refund.providerRefundId !== snapshot.id
        : snapshot.receipt !== id)
    )
      throw new AppError(
        409,
        "REFUND_MISMATCH",
        "The provider refund could not be matched.",
      );
    if (refund.status === "PROCESSED") return;
    const now = new Date();
    const status =
      snapshot.status === "processed"
        ? "PROCESSED"
        : snapshot.status === "failed"
          ? "FAILED"
          : "PROCESSING";
    if (refund.status === "FAILED" && status === "PROCESSING") return;
    await tx.refund.update({
      where: { id },
      data: {
        status,
        providerRefundId: snapshot.id,
        ...(status === "PROCESSED" ? { processedAt: now } : {}),
      },
    });
    if (status === "PROCESSED") {
      await postProcessedRefund(tx, booking, refund, now);
      await bookingAudit(tx, booking, "PAYMENT_REFUNDED", { refundId: id });
    } else if (status === "FAILED" && refund.status !== "FAILED") {
      await notify(tx, booking, "REFUND_FAILED", id);
      await bookingAudit(tx, booking, "PAYMENT_REFUND_FAILED", {
        refundId: id,
      });
    }
  });
}

export async function sendCompensation(id: string, gateway?: PaymentGateway) {
  const db = getPrisma();
  const refund = await db.refund.findUniqueOrThrow({
    where: { id },
    include: {
      payment: { select: { providerPaymentId: true, provider: true } },
    },
  });
  if (refund.payment.provider !== "RAZORPAY") return;
  if (refund.status === "PROCESSED" || refund.status === "FAILED") return;
  gateway ??= paymentGateway();
  const snapshot = refund.providerRefundId
    ? await gateway.getRefund(refund.providerRefundId)
    : await gateway.createRefund(
        refund.payment.providerPaymentId,
        refund.amount,
        id,
      );
  await recordRefund(id, snapshot);
}
