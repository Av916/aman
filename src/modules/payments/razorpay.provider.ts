import Razorpay from "razorpay";
import { z } from "zod";
import { AppError } from "@/lib/api";
import { bookingSettings } from "@/modules/bookings/settings";
import {
  orderEntity,
  paymentEntity,
  refundEntity,
  type PaymentGateway,
} from "./payment.provider";

export const providerUnavailable = () =>
  new AppError(
    503,
    "PAYMENT_PROVIDER_UNAVAILABLE",
    "The payment service is temporarily unavailable.",
  );

async function bounded<T>(start: () => Promise<unknown>, schema: z.ZodType<T>) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const data = await Promise.race([
      start(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(providerUnavailable()), 8000);
      }),
    ]);
    return schema.parse(data);
  } catch {
    throw providerUnavailable();
  } finally {
    clearTimeout(timer);
  }
}

export function paymentGateway(): PaymentGateway {
  const {
    RAZORPAY_KEY_ID: key_id,
    RAZORPAY_KEY_SECRET: key_secret,
    RAZORPAY_MOCK_URL: mock,
  } = bookingSettings();
  if (!key_id || !key_secret) throw providerUnavailable();
  const sdk = new Razorpay({ key_id, key_secret });
  async function mockRequest(path: string, body?: object, key?: string) {
    const reply = await fetch(new URL(path, mock), {
      method: body ? "POST" : "GET",
      headers: {
        "Content-Type": "application/json",
        ...(key ? { "X-Refund-Idempotency": key } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(7500),
    });
    if (!reply.ok) throw providerUnavailable();
    return reply.json() as Promise<unknown>;
  }
  return {
    createOrder(input) {
      const body = { ...input, partial_payment: false };
      return bounded(
        () => (mock ? mockRequest("/orders", body) : sdk.orders.create(body)),
        orderEntity,
      );
    },
    async findOrder(receipt) {
      const { items } = await bounded(
        () =>
          mock
            ? mockRequest(`/orders?receipt=${encodeURIComponent(receipt)}`)
            : sdk.orders.all({ receipt, count: 10 }),
        z.object({ items: z.array(orderEntity) }),
      );
      const matching = items.filter((item) => item.receipt === receipt);
      if (matching.length > 1) throw providerUnavailable();
      return matching[0];
    },
    getPayment(id) {
      return bounded(
        () => (mock ? mockRequest(`/payments/${id}`) : sdk.payments.fetch(id)),
        paymentEntity,
      );
    },
    async orderPayments(id) {
      return (
        await bounded(
          () =>
            mock
              ? mockRequest(`/orders/${id}/payments`)
              : sdk.orders.fetchPayments(id),
          z.object({ items: z.array(paymentEntity) }),
        )
      ).items;
    },
    createRefund(paymentId, amount, key) {
      const body = { amount, receipt: key, speed: "normal" as const };
      const headers = {
        "Content-Type": "application/json",
        "X-Refund-Idempotency": key,
      };
      return bounded(
        () =>
          mock
            ? mockRequest(`/payments/${paymentId}/refund`, body, key)
            : new Razorpay({ key_id, key_secret, headers }).payments.refund(
                paymentId,
                body,
              ),
        refundEntity,
      );
    },
    getRefund(id) {
      return bounded(
        () => (mock ? mockRequest(`/refunds/${id}`) : sdk.refunds.fetch(id)),
        refundEntity,
      );
    },
  };
}
