import { z } from "zod";
import { AppError, readBody, success } from "@/lib/api";
import { getPrisma } from "@/lib/prisma";
import { operationRoute } from "@/modules/operations/http";
import { paymentGateway } from "@/modules/payments/razorpay.provider";
import {
  attachOrder,
  processProviderPayment,
} from "@/modules/payments/payment.service";
import { isJobName, runJob } from "./jobs";
import { auditIntegrity } from "./integrity";
import { systemStatus } from "./status";

const confirmation = z.strictObject({
  confirmed: z.literal(true),
  reason: z.string().trim().min(5).max(300),
  action: z.enum(["retry-job", "retry-outbox", "reconcile-order"]),
  id: z.uuid(),
});

export const systemGet = operationRoute(
  async () => success("System status.", await systemStatus()),
  "ADMIN",
);
export const integrityGet = operationRoute(
  async () =>
    success("Integrity findings.", { findings: await auditIntegrity() }),
  "ADMIN",
);

export const recoverPost = operationRoute(async (request, actor) => {
  const input = await readBody(request, confirmation);
  const db = getPrisma();
  const audit = (entityType: string) => ({
    actorId: actor.id,
    entityType,
    entityId: input.id,
    action: input.action.toUpperCase().replaceAll("-", "_"),
    metadata: { reason: input.reason },
  });
  if (input.action === "retry-job") {
    const prior = await db.jobRun.findFirst({
      where: { id: input.id, status: { in: ["FAILED", "INTERRUPTED"] } },
    });
    if (!prior || !isJobName(prior.name))
      throw new AppError(
        404,
        "RETRY_UNAVAILABLE",
        "This run cannot be retried.",
      );
    await db.auditLog.create({ data: audit("JobRun") });
    return success("Work attempted.", await runJob(prior.name));
  }
  if (input.action === "retry-outbox") {
    await db.$transaction(async (tx) => {
      const changed = await tx.outboxEvent.updateMany({
        where: { id: input.id, status: "FAILED" },
        data: {
          status: "PENDING",
          attempts: 0,
          lastError: null,
          nextAttemptAt: new Date(),
        },
      });
      if (!changed.count)
        throw new AppError(
          404,
          "RETRY_UNAVAILABLE",
          "This delivery cannot be retried.",
        );
      await tx.auditLog.create({ data: audit("OutboxEvent") });
    });
    return success("Delivery queued.");
  }
  let order = await db.paymentOrder.findUnique({ where: { id: input.id } });
  if (!order) throw new AppError(404, "ORDER_NOT_FOUND", "Order not found.");
  await db.auditLog.create({ data: audit("PaymentOrder") });
  const gateway = paymentGateway();
  if (!order.providerOrderId) {
    const found = await gateway.findOrder(order.providerReceipt);
    if (found) order = await attachOrder(order, found);
  }
  let checked = 0;
  if (order.providerOrderId)
    for (const payment of await gateway.orderPayments(order.providerOrderId)) {
      await processProviderPayment(order, payment);
      checked++;
    }
  return success("Reconciliation completed.", {
    checked,
    orderFound: Boolean(order.providerOrderId),
  });
}, "ADMIN");
