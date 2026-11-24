import { finalizeReplacement } from "@/modules/rescheduling/service";
import { postCapture, postCharges } from "@/modules/finance/ledger";
import { AppError } from "@/lib/api";
import { getPrisma } from "@/lib/prisma";
import type { PaymentOrder, PaymentStatus } from "@/generated/prisma/client";
import { bookingSettings } from "@/modules/bookings/settings";
import {
  bookingAudit,
  lockBooking,
  transaction,
} from "@/modules/bookings/booking.repository";
import {
  assertTransition,
  expired,
  holdExpired,
} from "@/modules/bookings/booking.state-machine";
import {
  expireBooking,
  saveCheckout,
} from "@/modules/bookings/booking.service";
import type { CheckoutInput } from "@/modules/bookings/booking.validation";
import { releaseLockedBooking } from "@/modules/inventory/slot-release.service";
import { enqueue, notify } from "@/modules/notifications/service";
import { paymentGateway } from "./razorpay.provider";
import { verifySignature } from "./signatures";
import type {
  PaymentGateway,
  ProviderOrder,
  ProviderPayment,
} from "./payment.provider";

const notPayable = () =>
  new AppError(
    409,
    "BOOKING_NOT_PAYABLE",
    "This booking no longer accepts payments.",
  );
const invalidPayment = () =>
  new AppError(
    400,
    "PAYMENT_MISMATCH",
    "The payment could not be matched to this booking.",
  );

export async function attachOrder(
  order: PaymentOrder,
  candidate: ProviderOrder,
) {
  if (
    candidate.receipt !== order.providerReceipt ||
    candidate.amount !== order.amount ||
    candidate.currency !== order.currency
  )
    throw invalidPayment();
  await getPrisma().paymentOrder.updateMany({
    where: { id: order.id, providerOrderId: null },
    data: {
      providerOrderId: candidate.id,
      status: "PENDING",
      nextCheckAt: new Date(),
    },
  });
  const refreshed = await getPrisma().paymentOrder.findUniqueOrThrow({
    where: { id: order.id },
  });
  if (refreshed.providerOrderId !== candidate.id) throw invalidPayment();
  return refreshed;
}

export async function startPayment(
  customerId: string,
  bookingId: string,
  input: CheckoutInput,
  gateway: PaymentGateway = paymentGateway(),
) {
  await saveCheckout(bookingId, customerId, input);
  const claim = await transaction(async (tx) => {
    const { booking, pitch, venue } = await lockBooking(
      tx,
      bookingId,
      customerId,
    );
    const now = new Date();
    if (
      booking.status === "PENDING_PAYMENT" &&
      holdExpired(booking.holdExpiresAt, now)
    ) {
      await releaseLockedBooking(tx, booking, pitch, venue, "EXPIRED", now);
      return null;
    }
    if (booking.status !== "PENDING_PAYMENT" || !booking.termsAcceptedAt)
      throw notPayable();
    const existing = await tx.paymentOrder.findUnique({ where: { bookingId } });
    if (existing) return { order: existing, create: false };
    const order = await tx.paymentOrder.create({
      data: {
        bookingId,
        amount: booking.settlementDue ?? booking.totalAmount,
        currency: booking.currency,
        providerReceipt: booking.id,
        nextCheckAt: new Date(+now + 30_000),
      },
    });
    return { order, create: true };
  });
  if (!claim) throw expired();

  let { order } = claim;
  if (!order.providerOrderId) {
    const result = claim.create
      ? await gateway.createOrder({
          receipt: order.providerReceipt,
          amount: order.amount,
          currency: order.currency,
        })
      : await gateway.findOrder(order.providerReceipt);
    if (!result)
      throw new AppError(
        503,
        "ORDER_RECONCILING",
        "The existing payment order is being reconciled. Try again shortly.",
      );
    order = await attachOrder(order, result);
  }
  const booking = await expireBooking(bookingId, customerId);
  if (booking.status === "EXPIRED") throw expired();
  if (booking.status !== "PENDING_PAYMENT") throw notPayable();
  return {
    id: order.id,
    orderId: order.providerOrderId,
    amount: order.amount,
    currency: order.currency,
    key: bookingSettings().RAZORPAY_KEY_ID,
    bookingId,
  };
}

const preserve = new Set<PaymentStatus>([
  "CAPTURED",
  "REFUND_PENDING",
  "PARTIALLY_REFUNDED",
  "REFUNDED",
]);

export async function processProviderPayment(
  order: PaymentOrder,
  incoming: ProviderPayment,
) {
  if (!order.providerOrderId || order.providerOrderId !== incoming.order_id)
    throw invalidPayment();
  return transaction(async (tx) => {
    const { booking, pitch, venue } = await lockBooking(tx, order.bookingId);
    const old = await tx.payment.findUnique({
      where: { providerPaymentId: incoming.id },
    });
    if (
      old &&
      (old.orderId !== order.id ||
        old.amount !== incoming.amount ||
        old.currency !== incoming.currency)
    )
      throw invalidPayment();
    if (old && preserve.has(old.status))
      return {
        status: booking.status,
        paymentStatus: old.status,
        validAmount:
          old.amount === (booking.settlementDue ?? booking.totalAmount) &&
          old.currency === booking.currency,
      };
    if (
      old?.status === "AUTHORIZED" &&
      (incoming.status === "created" || incoming.status === "failed")
    ) {
      return {
        status: booking.status,
        paymentStatus: old.status,
        validAmount:
          old.amount === (booking.settlementDue ?? booking.totalAmount) &&
          old.currency === booking.currency,
      };
    }
    await tx.$queryRaw`
      SELECT c.id FROM "Coupon" c JOIN "CouponRedemption" r ON r."couponId" = c.id
      WHERE r."bookingId" = ${booking.id}::uuid AND r.status = 'RESERVED' FOR UPDATE OF c
    `;
    const now = new Date();
    const captured =
      incoming.status === "captured" && incoming.captured !== false;
    const validAmount =
      incoming.amount === (booking.settlementDue ?? booking.totalAmount) &&
      incoming.currency === booking.currency;
    const status: PaymentStatus = captured
      ? "CAPTURED"
      : incoming.status === "failed"
        ? "FAILED"
        : incoming.status === "authorized"
          ? "AUTHORIZED"
          : incoming.status === "refunded"
            ? "REFUNDED"
            : "PENDING";
    const values = {
      status,
      paymentMethod: incoming.method ?? null,
      failureCode: status === "FAILED" ? "PROVIDER_FAILED" : null,
      failureReason:
        status === "FAILED" ? "The provider reported a failed attempt." : null,
      paidAt: captured ? now : null,
    };
    const payment = await tx.payment.upsert({
      where: { providerPaymentId: incoming.id },
      update: values,
      create: {
        bookingId: booking.id,
        orderId: order.id,
        providerPaymentId: incoming.id,
        amount: incoming.amount,
        currency: incoming.currency,
        ...values,
      },
    });

    if (!captured) {
      if (
        status === "FAILED" &&
        old?.status !== "FAILED" &&
        booking.status === "PENDING_PAYMENT"
      )
        await notify(tx, booking, "PAYMENT_FAILED", payment.id);
      if (status === "AUTHORIZED")
        await tx.paymentOrder.updateMany({
          where: { id: order.id, status: { in: ["CREATED", "PENDING"] } },
          data: { status: "AUTHORIZED" },
        });
      return { status: booking.status, paymentStatus: status, validAmount };
    }

    await postCapture(tx, booking, payment, now);
    await tx.paymentOrder.update({
      where: { id: order.id },
      data: { status: "CAPTURED" },
    });
    let state = booking.status;
    if (
      state === "PENDING_PAYMENT" &&
      holdExpired(booking.holdExpiresAt, now)
    ) {
      await releaseLockedBooking(tx, booking, pitch, venue, "EXPIRED", now);
      state = "EXPIRED";
    }

    if (
      state === "PENDING_PAYMENT" &&
      booking.termsAcceptedAt &&
      validAmount &&
      booking.rescheduledFromId
    ) {
      if (await finalizeReplacement(tx, booking, pitch, venue, payment, now))
        return {
          status: "CONFIRMED" as const,
          paymentStatus: "CAPTURED" as const,
          validAmount,
        };
    }
    if (
      state === "PENDING_PAYMENT" &&
      booking.termsAcceptedAt &&
      validAmount &&
      !booking.rescheduledFromId
    ) {
      const items = await tx.bookingItem.findMany({
        where: { bookingId: booking.id },
        select: { originalSlotId: true },
      });
      const match = {
        pitchId: pitch.id,
        id: { in: items.map((item) => item.originalSlotId) },
        activeBookingId: booking.id,
        status: "HELD" as const,
        holdExpiresAt: { gt: now },
      };
      if (
        items.length &&
        (await tx.slot.count({ where: match })) === items.length
      ) {
        assertTransition(state, "CONFIRMED");
        const changed = await tx.slot.updateMany({
          where: match,
          data: { status: "BOOKED", holdExpiresAt: null },
        });
        if (changed.count !== items.length)
          throw new AppError(
            409,
            "INVENTORY_CHANGED",
            "The reservation is being reconciled.",
          );
        await tx.booking.update({
          where: { id: booking.id },
          data: {
            status: "CONFIRMED",
            confirmedAt: now,
            confirmedPaymentId: payment.id,
          },
        });
        await tx.couponRedemption.updateMany({
          where: { bookingId: booking.id, status: "RESERVED" },
          data: { status: "REDEEMED" },
        });
        await postCharges(tx, booking, payment.id, now);
        await bookingAudit(tx, booking, "BOOKING_CONFIRMED", {
          paymentId: payment.id,
        });
        await notify(tx, booking, "BOOKING_CONFIRMED");
        await enqueue(
          tx,
          "BOOKING_RECEIPT",
          booking.id,
          `receipt:${booking.id}`,
        );
        return {
          status: "CONFIRMED" as const,
          paymentStatus: "CAPTURED" as const,
          validAmount,
        };
      }
    }

    const reason = !validAmount
      ? "Captured amount or currency differed from the booking."
      : booking.confirmedPaymentId
        ? "An additional payment was captured."
        : "The capture arrived after the reservation stopped being eligible.";
    const sourceKey = `compensation:${payment.id}`;
    const refund = await tx.refund.upsert({
      where: { sourceKey },
      update: {},
      create: {
        sourceKey,
        paymentId: payment.id,
        bookingId: booking.id,
        amount: payment.amount,
        reason,
      },
    });
    await tx.payment.update({
      where: { id: payment.id },
      data: { status: "REFUND_PENDING" },
    });
    await enqueue(tx, "COMPENSATING_REFUND", refund.id, `refund:${refund.id}`);
    await notify(tx, booking, "REFUND_INITIATED", refund.id);
    await bookingAudit(tx, booking, "PAYMENT_COMPENSATION_REQUIRED", {
      paymentId: payment.id,
      refundId: refund.id,
    });
    return {
      status: state,
      paymentStatus: "REFUND_PENDING" as const,
      validAmount,
    };
  });
}

export async function verifyCheckout(
  customerId: string,
  input: {
    bookingId: string;
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  },
  gateway: PaymentGateway = paymentGateway(),
) {
  const order = await getPrisma().paymentOrder.findFirst({
    where: { bookingId: input.bookingId, booking: { customerId } },
  });
  const secret = bookingSettings().RAZORPAY_KEY_SECRET;
  if (
    !order?.providerOrderId ||
    !secret ||
    input.razorpay_order_id !== order.providerOrderId ||
    !verifySignature(
      `${order.providerOrderId}|${input.razorpay_payment_id}`,
      input.razorpay_signature,
      secret,
    )
  )
    throw invalidPayment();
  const payment = await gateway.getPayment(input.razorpay_payment_id);
  if (payment.id !== input.razorpay_payment_id) throw invalidPayment();
  return processProviderPayment(order, payment);
}
