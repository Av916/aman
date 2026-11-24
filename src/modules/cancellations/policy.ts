import type { Prisma } from "@/generated/prisma/client";
import { z } from "zod";

const rule = z.object({
  minimumHoursBeforeBooking: z.number().int().min(0).max(720),
  refundPercentage: z.number().int().min(0).max(100),
});

export const policyInput = z.strictObject({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500),
  rules: z
    .array(rule)
    .min(1)
    .max(12)
    .refine(
      (rules) =>
        new Set(rules.map((entry) => entry.minimumHoursBeforeBooking)).size ===
        rules.length,
      "Each threshold must be unique.",
    ),
});

const snapshotSchema = policyInput.extend({
  version: z.number().int().nonnegative(),
});
export const defaultPolicy: z.infer<typeof snapshotSchema> = {
  name: "Standard cancellation policy",
  description:
    "Customer cancellations qualify for a full refund at least 24 hours before start and a half refund at least 12 hours before start.",
  version: 0,
  rules: [
    { minimumHoursBeforeBooking: 24, refundPercentage: 100 },
    { minimumHoursBeforeBooking: 12, refundPercentage: 50 },
    { minimumHoursBeforeBooking: 0, refundPercentage: 0 },
  ],
};

export async function snapshotPolicy(
  db: Prisma.TransactionClient,
  venueId: string,
) {
  const policy = await db.cancellationPolicy.findFirst({
    where: { venueId, isActive: true },
    select: {
      name: true,
      description: true,
      version: true,
      rules: {
        select: { minimumHoursBeforeBooking: true, refundPercentage: true },
        orderBy: { minimumHoursBeforeBooking: "desc" },
      },
    },
  });
  return policy ?? defaultPolicy;
}

export function readPolicy(snapshot: unknown) {
  const parsed = snapshotSchema.safeParse(snapshot);
  return parsed.success ? parsed.data : defaultPolicy;
}

export function refundQuote(
  booking: { startAt: Date; cancellationPolicySnapshot: unknown },
  captured: number,
  reserved: number,
  now: Date,
  operator: boolean,
) {
  const policy = readPolicy(booking.cancellationPolicySnapshot);
  const remaining = Math.max(0, captured - reserved);
  const hours = (+booking.startAt - +now) / 3_600_000;
  const percentage = operator
    ? 100
    : ([...policy.rules]
        .sort(
          (a, b) => b.minimumHoursBeforeBooking - a.minimumHoursBeforeBooking,
        )
        .find((item) => hours >= item.minimumHoursBeforeBooking)
        ?.refundPercentage ?? 0);
  const refundAmount = Math.min(
    remaining,
    Math.max(0, Math.floor((captured * percentage) / 100) - reserved),
  );
  return {
    policy,
    refundAmount,
    percentage,
    nonRefundableAmount: remaining - refundAmount,
  };
}
