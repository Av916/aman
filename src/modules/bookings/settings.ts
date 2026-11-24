import { z } from "zod";
const secret = z.preprocess(
  (v) => v || undefined,
  z.string().min(12).optional(),
);
const schema = z
  .object({
    CHECK_IN_EARLY_MINUTES: z.coerce.number().int().min(0).max(120).default(30),
    BOOKING_REMINDER_MINUTES: z
      .string()
      .regex(/^(?:[1-9]\d{0,3})(?:,[1-9]\d{0,3}){0,5}$/)
      .default("1440,120")
      .transform((value) => [...new Set(value.split(",").map(Number))]),
    BOOKING_HOLD_MINUTES: z.coerce.number().int().min(1).max(30).default(10),
    MAX_ACTIVE_HOLDS_PER_USER: z.coerce.number().int().min(1).max(5).default(1),
    PLATFORM_FEE_PAISE: z.coerce
      .number()
      .int()
      .min(0)
      .max(1_000_000)
      .default(5000),
    TAX_RATE_BPS: z.coerce.number().int().min(0).max(10000).default(0),
    RAZORPAY_KEY_ID: secret,
    RAZORPAY_KEY_SECRET: secret,
    RAZORPAY_WEBHOOK_SECRET: secret,
    INTERNAL_JOB_SECRET: z.preprocess(
      (v) => v || undefined,
      z.string().min(32).optional(),
    ),
    RAZORPAY_MOCK_URL: z.preprocess(
      (v) => v || undefined,
      z.url({ protocol: /^http$/ }).optional(),
    ),
  })
  .refine(
    (v) =>
      [
        v.RAZORPAY_KEY_ID,
        v.RAZORPAY_KEY_SECRET,
        v.RAZORPAY_WEBHOOK_SECRET,
      ].every(Boolean) ||
      [
        v.RAZORPAY_KEY_ID,
        v.RAZORPAY_KEY_SECRET,
        v.RAZORPAY_WEBHOOK_SECRET,
      ].every((s) => !s),
    {
      path: ["RAZORPAY_KEY_ID"],
      message: "Configure the Razorpay credentials together.",
    },
  );

export function bookingSettings() {
  const value = schema.safeParse(process.env);
  if (!value.success)
    throw new Error(
      `Invalid booking environment (${value.error.issues.map((issue) => issue.path.join(".")).join(", ")}).`,
    );
  if (
    value.data.RAZORPAY_MOCK_URL &&
    (!["127.0.0.1", "localhost"].includes(
      new URL(value.data.RAZORPAY_MOCK_URL).hostname,
    ) ||
      !["127.0.0.1", "localhost"].includes(
        new URL(process.env.APP_URL ?? "http://localhost").hostname,
      ) ||
      !value.data.RAZORPAY_KEY_ID?.startsWith("rzp_test_"))
  )
    throw new Error("The payment mock requires loopback and test credentials.");
  return value.data;
}
