import { z } from "zod";
import { getEnv } from "./env";
import { bookingSettings } from "@/modules/bookings/settings";

const schema = z.object({
  APP_ENV: z.enum(["development", "test", "staging", "production"]).optional(),
  DB_POOL_MAX: z.coerce.number().int().min(1).max(40).default(10),
  CSP_MODE: z.enum(["report-only", "enforce"]).default("report-only"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  SUPPORT_EMAIL: z.preprocess((v) => v || undefined, z.email().optional()),
  CRON_SECRET: z.preprocess(
    (v) => v || undefined,
    z.string().min(32).optional(),
  ),
});

export function deploymentSettings() {
  const settings = schema.safeParse(process.env);
  if (!settings.success)
    throw new Error(
      `Invalid deployment settings (${settings.error.issues.map(({ path }) => path.join(".")).join(", ")}).`,
    );
  return settings.data;
}

export function validateDeployment() {
  const env = getEnv();
  const settings = deploymentSettings();
  const payment = bookingSettings();
  const origin = new URL(env.APP_URL);
  const hosted =
    process.env.VERCEL === "1" ||
    (process.env.NODE_ENV === "production" &&
      !["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname));
  if (!hosted) return;
  const expected = process.env.VERCEL_ENV === "preview" ? "staging" : undefined;
  if (
    !["staging", "production"].includes(settings.APP_ENV ?? "") ||
    (expected && settings.APP_ENV !== expected)
  )
    throw new Error("Set APP_ENV to the correct hosted environment.");
  if (
    !["require", "verify-ca", "verify-full"].includes(
      new URL(env.DATABASE_URL).searchParams.get("sslmode") ?? "",
    )
  )
    throw new Error("Hosted DATABASE_URL must request PostgreSQL TLS.");
  if (
    !settings.SUPPORT_EMAIL ||
    !process.env.CLOUDINARY_CLOUD_NAME ||
    !process.env.CLOUDINARY_API_KEY ||
    !process.env.CLOUDINARY_API_SECRET ||
    !payment.INTERNAL_JOB_SECRET ||
    (process.env.VERCEL === "1" && !settings.CRON_SECRET)
  )
    throw new Error(
      "Hosted deployment requires support, persistent media, and scheduler configuration.",
    );
  if (
    settings.APP_ENV === "staging" &&
    !payment.RAZORPAY_KEY_ID?.startsWith("rzp_test_")
  )
    throw new Error("Staging requires Razorpay test credentials.");
  if (
    settings.APP_ENV === "production" &&
    payment.RAZORPAY_KEY_ID &&
    (!payment.RAZORPAY_KEY_ID.startsWith("rzp_live_") ||
      process.env.ENABLE_LIVE_PAYMENTS !== "true")
  )
    throw new Error("Live payment credentials require explicit activation.");
}
