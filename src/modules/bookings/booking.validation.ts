import { z } from "zod";
import { BookingStatus } from "@/generated/prisma/enums";
import { phone } from "@/modules/auth/schemas";

import { couponCode } from "@/modules/coupons/code";

export const selection = z.strictObject({
  pitchId: z.uuid(),
  couponCode: couponCode.optional(),
  slotIds: z
    .array(z.uuid())
    .min(1)
    .max(48)
    .refine(
      (items) => new Set(items).size === items.length,
      "Select each slot once.",
    ),
  addons: z
    .array(
      z.strictObject({
        addonId: z.uuid(),
        quantity: z.number().int().min(1).max(20),
      }),
    )
    .max(12)
    .default([])
    .refine(
      (items) =>
        new Set(items.map((item) => item.addonId)).size === items.length,
      "Select each add-on once.",
    ),
});
export const createBookingInput = selection.extend({
  quoteFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
});
export const checkoutInput = z.strictObject({
  customerName: z.string().trim().min(2).max(80),
  customerEmail: z.email().max(254),
  customerPhone: phone,
  playerCount: z.number().int().min(1).max(500),
  customerNotes: z.string().trim().max(500).default(""),
  termsAccepted: z.literal(true),
});
export const orderInput = checkoutInput.extend({ bookingId: z.uuid() });
export const bookingListQuery = z.object({
  status: z.enum(BookingStatus).default("CONFIRMED"),
  page: z.coerce.number().int().min(1).max(1000).default(1),
});
export const bookingHistoryQuery = bookingListQuery.extend({
  status: z
    .enum(BookingStatus)
    .or(z.literal("PAST_CONFIRMED"))
    .default("CONFIRMED"),
});
export const idempotencyKeySchema = z.string().regex(/^[A-Za-z0-9_-]{8,100}$/);
export type Selection = z.output<typeof selection>;
export type CreateBookingInput = z.output<typeof createBookingInput>;
export type CheckoutInput = z.output<typeof checkoutInput>;
