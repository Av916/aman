import { limitAttempt } from "@/modules/auth/rate-limit";
import { log } from "@/lib/log";
import { after } from "next/server";
import { AppError, endpoint, readBody } from "@/lib/api";
import { getPrisma } from "@/lib/prisma";
import { roleRoute, json } from "@/modules/venues/http";
import { orderInput } from "@/modules/bookings/booking.validation";
import { bookingSettings } from "@/modules/bookings/settings";
import { startPayment, verifyCheckout } from "./payment.service";
import { verifyInput } from "./payment.provider";
import { persistWebhook, processWebhook } from "./webhook.service";

export const orderPost = roleRoute("CUSTOMER", async (r, who) => {
  const { bookingId, ...input } = await readBody(r, orderInput);
  await limitAttempt("payment-order", r.headers, `${who}:${bookingId}`, {
    global: 2000,
    ip: 50,
    identity: 5,
    seconds: 60,
  });
  return json(
    "Payment order ready.",
    await startPayment(who, bookingId, input),
  );
});
export const verifyPost = roleRoute("CUSTOMER", async (r, who) => {
  const result = await verifyCheckout(who, await readBody(r, verifyInput));
  if (!result.validAmount)
    throw new AppError(
      409,
      "PAYMENT_AMOUNT_MISMATCH",
      "The captured amount did not match the booking. Check your booking for refund status.",
    );
  return json("Payment checked.", result);
});
export const paymentStatusGet = roleRoute<{ id: string }>(
  "CUSTOMER",
  async (_r, who, { id }) => {
    const db = getPrisma();
    const select = {
      id: true,
      bookingId: true,
      amount: true,
      currency: true,
      status: true,
    } as const;
    const payment =
      (await db.payment.findFirst({
        where: { id, booking: { customerId: who } },
        select,
      })) ??
      (await db.paymentOrder.findFirst({
        where: { id, booking: { customerId: who } },
        select,
      }));
    if (!payment)
      throw new AppError(404, "PAYMENT_NOT_FOUND", "Payment not found.");
    return json("Payment status loaded.", { payment });
  },
);

async function webhookBytes(request: Request) {
  const limit = 128 * 1024;
  if (Number(request.headers.get("content-length")) > limit)
    throw new AppError(
      413,
      "BODY_TOO_LARGE",
      "Webhook exceeds the body limit.",
    );
  const reader = request.body?.getReader();
  const chunks: Buffer[] = [];
  let size = 0;
  while (reader) {
    const item = await reader.read();
    if (item.done) break;
    size += item.value.byteLength;
    if (size > limit) {
      await reader.cancel();
      throw new AppError(
        413,
        "BODY_TOO_LARGE",
        "Webhook exceeds the body limit.",
      );
    }
    chunks.push(Buffer.from(item.value));
  }
  return Buffer.concat(chunks);
}

export const webhookPost = endpoint(async (r) => {
  const secret = bookingSettings().RAZORPAY_WEBHOOK_SECRET;
  if (!secret)
    throw new AppError(
      503,
      "WEBHOOK_UNCONFIGURED",
      "Webhook configuration is unavailable.",
    );
  const event = await persistWebhook(
    await webhookBytes(r),
    r.headers.get("x-razorpay-signature"),
    r.headers.get("x-razorpay-event-id"),
    secret,
  );
  after(() =>
    processWebhook(event.id).catch(() => {
      log("error", "payment.webhook_deferred", {
        code: "WEBHOOK_PROCESSING_FAILED",
      });
    }),
  );
  return json("Webhook received.");
});
