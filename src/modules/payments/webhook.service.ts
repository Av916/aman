import { z } from "zod";
import { AppError } from "@/lib/api";
import { getPrisma } from "@/lib/prisma";
import {
  orderId,
  paymentId,
  refundId,
  type PaymentGateway,
} from "./payment.provider";
import { paymentGateway } from "./razorpay.provider";
import { processProviderPayment } from "./payment.service";
import { recordRefund } from "./refund.service";
import { verifySignature } from "./signatures";

const envelope = z.object({
  event: z.string().min(1).max(80),
  payload: z.object({
    payment: z
      .object({
        entity: z.object({
          id: paymentId,
          order_id: orderId.nullable().optional(),
        }),
      })
      .optional(),
    order: z.object({ entity: z.object({ id: orderId }) }).optional(),
    refund: z
      .object({ entity: z.object({ id: refundId, payment_id: paymentId }) })
      .optional(),
  }),
});
const work = z.object({
  paymentId: paymentId.optional(),
  orderId: orderId.optional(),
  refundId: refundId.optional(),
});

export async function persistWebhook(
  raw: Uint8Array,
  supplied: string | null,
  eventId: string | null,
  secret: string,
) {
  if (!verifySignature(raw, supplied, secret))
    throw new AppError(401, "WEBHOOK_SIGNATURE", "Invalid webhook signature.");
  if (!eventId || !/^[A-Za-z0-9_-]{1,128}$/.test(eventId))
    throw new AppError(
      400,
      "WEBHOOK_EVENT_ID",
      "Missing or invalid event identifier.",
    );
  let content: unknown;
  try {
    content = JSON.parse(new TextDecoder().decode(raw));
  } catch {
    throw new AppError(400, "WEBHOOK_JSON", "Malformed webhook.");
  }
  const event = envelope.parse(content);
  const ids = {
    paymentId:
      event.payload.payment?.entity.id ??
      event.payload.refund?.entity.payment_id,
    orderId:
      event.payload.order?.entity.id ??
      event.payload.payment?.entity.order_id ??
      undefined,
    refundId: event.payload.refund?.entity.id,
  };
  const payload = Object.fromEntries(
    Object.entries(ids).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
  const db = getPrisma();
  await db.paymentWebhookEvent.createMany({
    data: [{ providerEventId: eventId, eventType: event.event, payload }],
    skipDuplicates: true,
  });
  return db.paymentWebhookEvent.findUniqueOrThrow({
    where: {
      provider_providerEventId: {
        provider: "RAZORPAY",
        providerEventId: eventId,
      },
    },
  });
}

export async function processWebhook(id: string, injected?: PaymentGateway) {
  const db = getPrisma();
  const now = new Date();
  const grabbed = await db.paymentWebhookEvent.updateMany({
    where: {
      id,
      processingStatus: { in: ["PENDING", "PROCESSING"] },
      nextAttemptAt: { lte: now },
    },
    data: {
      processingStatus: "PROCESSING",
      attemptCount: { increment: 1 },
      nextAttemptAt: new Date(+now + 90_000),
    },
  });
  if (!grabbed.count) return false;
  const event = await db.paymentWebhookEvent.findUniqueOrThrow({
    where: { id },
  });
  const lease = { id, attemptCount: event.attemptCount };
  try {
    const data = work.parse(event.payload);
    if (
      [
        "payment.authorized",
        "payment.captured",
        "payment.failed",
        "order.paid",
      ].includes(event.eventType)
    ) {
      const gateway = injected ?? paymentGateway();
      const payment = data.paymentId
        ? await gateway.getPayment(data.paymentId)
        : null;
      if (
        payment &&
        (payment.id !== data.paymentId ||
          (data.orderId && payment.order_id !== data.orderId))
      )
        throw new Error("Provider event did not match its payment.");
      const gatewayOrder = payment?.order_id ?? data.orderId;
      const order =
        gatewayOrder &&
        (await db.paymentOrder.findUnique({
          where: { providerOrderId: gatewayOrder },
        }));
      if (!order) throw new Error("Order has not been linked.");
      const candidates = payment
        ? [payment]
        : await gateway.orderPayments(gatewayOrder!);
      if (!candidates.length) throw new Error("No payment has been reported.");
      if (
        ["payment.captured", "order.paid"].includes(event.eventType) &&
        !candidates.some(
          (item) => item.status === "captured" || item.status === "refunded",
        )
      )
        throw new Error("Capture is not yet visible.");
      for (const item of candidates) await processProviderPayment(order, item);
    } else if (
      ["refund.processed", "refund.failed"].includes(event.eventType) &&
      data.refundId
    ) {
      const snapshot = await (injected ?? paymentGateway()).getRefund(
        data.refundId,
      );
      if (
        snapshot.id !== data.refundId ||
        (data.paymentId && snapshot.payment_id !== data.paymentId)
      )
        throw new Error("Provider event did not match its refund.");
      const refund = await db.refund.findFirst({
        where: {
          OR: [
            { providerRefundId: snapshot.id },
            ...(z.uuid().safeParse(snapshot.receipt).success
              ? [{ id: snapshot.receipt! }]
              : []),
          ],
        },
        select: { id: true },
      });
      if (refund) {
        if (snapshot.status === "pending")
          throw new Error("Refund result is not yet visible.");
        await recordRefund(refund.id, snapshot);
      }
    }
    await db.paymentWebhookEvent.updateMany({
      where: lease,
      data: {
        processingStatus: "PROCESSED",
        processedAt: new Date(),
        lastError: null,
      },
    });
    return true;
  } catch {
    await db.paymentWebhookEvent.updateMany({
      where: lease,
      data: {
        processingStatus: event.attemptCount >= 10 ? "FAILED" : "PENDING",
        lastError: "Provider event requires reconciliation.",
        nextAttemptAt: new Date(
          Date.now() + Math.min(3600, 15 * 2 ** event.attemptCount) * 1000,
        ),
      },
    });
    return false;
  }
}
