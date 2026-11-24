import { z } from "zod";
import { AppError } from "@/lib/api";
import type { Coupon, Prisma } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { transaction } from "@/modules/bookings/booking.repository";
import {
  requireVenueAccess,
  requireVenueWrite,
  venueScope,
  type Actor,
} from "@/modules/permissions/operations";

import { couponCode } from "./code";
const positive = z.number().int().positive().max(2147483647);
export const couponInput = z
  .strictObject({
    venueId: z.uuid().nullable(),
    code: couponCode,
    description: z.string().trim().max(300),
    discountType: z.enum(["FIXED", "PERCENTAGE"]),
    discountValue: positive,
    maximumDiscount: positive.nullable(),
    minimumBookingAmount: z.number().int().nonnegative().max(2147483647),
    usageLimit: positive.nullable(),
    usageLimitPerCustomer: positive.nullable(),
    startsAt: z.iso.datetime().transform((value) => new Date(value)),
    expiresAt: z.iso.datetime().transform((value) => new Date(value)),
    isActive: z.boolean().default(true),
  })
  .refine(
    (input) =>
      input.startsAt < input.expiresAt &&
      (input.discountType === "FIXED" || input.discountValue <= 100),
    "Check the discount and dates.",
  );

export function couponDiscount(
  coupon: Pick<Coupon, "discountType" | "discountValue" | "maximumDiscount">,
  subtotal: number,
) {
  const value =
    coupon.discountType === "FIXED"
      ? coupon.discountValue
      : Math.floor((subtotal * coupon.discountValue) / 100);
  return Math.min(subtotal, value, coupon.maximumDiscount ?? value);
}

export async function resolveCoupon(
  tx: Prisma.TransactionClient,
  code: string,
  venueId: string,
  customerId: string,
  subtotal: number,
  now: Date,
  lock: boolean,
) {
  if (lock)
    await tx.$queryRaw`SELECT id FROM "Coupon" WHERE code = ${code} FOR UPDATE`;
  const coupon = await tx.coupon.findUnique({ where: { code } });
  const unavailable = () =>
    new AppError(
      409,
      "COUPON_UNAVAILABLE",
      "This code is unavailable for the selected booking.",
    );
  if (
    !coupon ||
    !coupon.isActive ||
    (coupon.venueId && coupon.venueId !== venueId) ||
    coupon.startsAt > now ||
    coupon.expiresAt <= now ||
    coupon.minimumBookingAmount > subtotal
  )
    throw unavailable();
  const active: Prisma.CouponRedemptionWhereInput = {
    couponId: coupon.id,
    OR: [
      { status: "REDEEMED" },
      { status: "RESERVED", expiresAt: { gt: now } },
    ],
  };
  if (
    coupon.usageLimit !== null &&
    (await tx.couponRedemption.count({ where: active })) >= coupon.usageLimit
  )
    throw unavailable();
  if (
    coupon.usageLimitPerCustomer !== null &&
    (await tx.couponRedemption.count({ where: { ...active, customerId } })) >=
      coupon.usageLimitPerCustomer
  )
    throw unavailable();
  const amount = couponDiscount(coupon, subtotal);
  if (!amount) throw unavailable();
  return { id: coupon.id, code, amount, expiresAt: coupon.expiresAt };
}

export async function listCoupons(actor: Actor, admin = false) {
  const db = getPrisma();
  if (admin && actor.role !== "ADMIN")
    throw new AppError(403, "FORBIDDEN", "Administrator access is required.");
  const venues = admin
    ? []
    : await db.venue.findMany({
        where: venueScope(actor, "coupons"),
        select: { id: true },
      });
  return db.coupon.findMany({
    where: { venueId: admin ? null : { in: venues.map((venue) => venue.id) } },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { _count: { select: { redemptions: true } } },
  });
}

export function saveCoupon(
  actor: Actor,
  input: z.output<typeof couponInput>,
  id?: string,
) {
  return transaction(async (tx) => {
    const verify = async (venueId: string | null) => {
      if (venueId) await requireVenueWrite(tx, actor, venueId, "coupons");
      else if (actor.role !== "ADMIN")
        throw new AppError(
          403,
          "FORBIDDEN",
          "Platform coupons require an administrator.",
        );
    };
    await verify(input.venueId);
    if (id) {
      await tx.$queryRaw`SELECT id FROM "Coupon" WHERE id = ${id}::uuid FOR UPDATE`;
      const previous = await tx.coupon.findUniqueOrThrow({ where: { id } });
      await verify(previous.venueId);
      if (previous.code !== input.code || previous.venueId !== input.venueId)
        throw new AppError(
          422,
          "COUPON_IDENTITY",
          "Create a new coupon to change its code or venue.",
        );
    }
    const result = id
      ? await tx.coupon.update({ where: { id }, data: input })
      : await tx.coupon.create({ data: { ...input, createdById: actor.id } });
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: "COUPON_SAVED",
        entityType: "Coupon",
        entityId: result.id,
      },
    });
    return result;
  });
}

export async function deactivateCoupon(actor: Actor, id: string) {
  const previous = await getPrisma().coupon.findUniqueOrThrow({
    where: { id },
  });
  if (previous.venueId)
    await requireVenueAccess(getPrisma(), actor, previous.venueId, "coupons");
  return saveCoupon(
    actor,
    {
      ...previous,
      isActive: false,
    },
    id,
  );
}
