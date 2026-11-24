import { z } from "zod";

export const orderId = z
  .string()
  .regex(/^order_[a-zA-Z0-9]+$/)
  .max(64);
export const paymentId = z
  .string()
  .regex(/^pay_[a-zA-Z0-9]+$/)
  .max(64);
export const refundId = z
  .string()
  .regex(/^rfnd_[a-zA-Z0-9]+$/)
  .max(64);
export const signature = z.string().regex(/^[0-9a-f]{64}$/i);
export const orderEntity = z.object({
  id: orderId,
  receipt: z.string().max(40).nullable(),
  amount: z.coerce.number().int().positive(),
  currency: z.string().length(3),
  status: z.enum(["created", "attempted", "paid"]),
});
export const paymentEntity = z.object({
  id: paymentId,
  order_id: orderId,
  amount: z.number().int().positive().max(2147483647),
  currency: z.string().regex(/^[A-Z]{3}$/),
  status: z.enum(["created", "authorized", "captured", "refunded", "failed"]),
  captured: z.boolean().optional(),
  method: z
    .string()
    .regex(/^[a-z0-9_-]{1,30}$/i)
    .nullable()
    .optional(),
  created_at: z.number().int().nonnegative().max(4102444800).optional(),
});
export const refundEntity = z.object({
  id: refundId,
  payment_id: paymentId,
  status: z.enum(["pending", "processed", "failed"]),
  amount: z.number().int().positive(),
  receipt: z.string().nullable().optional(),
});
export const verifyInput = z.strictObject({
  bookingId: z.uuid(),
  razorpay_order_id: orderId,
  razorpay_payment_id: paymentId,
  razorpay_signature: signature,
});

export type ProviderOrder = z.output<typeof orderEntity>;
export type ProviderPayment = z.output<typeof paymentEntity>;
export type ProviderRefund = z.output<typeof refundEntity>;
export interface PaymentGateway {
  createOrder(input: {
    receipt: string;
    amount: number;
    currency: string;
  }): Promise<ProviderOrder>;
  findOrder(receipt: string): Promise<ProviderOrder | undefined>;
  getPayment(id: string): Promise<ProviderPayment>;
  orderPayments(id: string): Promise<ProviderPayment[]>;
  createRefund(
    paymentId: string,
    amount: number,
    key: string,
  ): Promise<ProviderRefund>;
  getRefund(id: string): Promise<ProviderRefund>;
}
