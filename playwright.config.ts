import "dotenv/config";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig, devices } from "@playwright/test";

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl || databaseUrl === process.env.DATABASE_URL)
  throw new Error("Set TEST_DATABASE_URL to a separate migrated database.");

const port = 3100;
const origin = `http://localhost:${port}`;
const mailDirectory =
  process.env.PITCHMATE_E2E_MAIL_DIR ??
  mkdtempSync(join(tmpdir(), "pitchmate-e2e-mail-"));
process.env.PITCHMATE_E2E_MAIL_DIR = mailDirectory;

export default defineConfig({
  testDir: "./tests/e2e",
  workers: 1,
  timeout: 75_000,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: origin,
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "bun tests/support/razorpay-mock.js",
      url: "http://127.0.0.1:3112/health",
    },
    {
      command: `bun run build && bun run start --hostname 127.0.0.1 --port ${port}`,
      url: `${origin}/api/health`,
      timeout: 120_000,
      env: {
        DATABASE_URL: databaseUrl,
        APP_ENV: "test",
        CRON_SECRET: "pitchmate-e2e-cron-secret-test-only",
        LOG_LEVEL: "error",
        RAZORPAY_MOCK_URL: "http://127.0.0.1:3112",
        RAZORPAY_KEY_ID: "rzp_test_pitchmate_e2e",
        RAZORPAY_KEY_SECRET: "pitchmate-mock-checkout-secret",
        RAZORPAY_WEBHOOK_SECRET: "pitchmate-mock-webhook-secret",
        INTERNAL_JOB_SECRET: "pitchmate-e2e-jobs-test-secret-only",
        PLATFORM_FEE_PAISE: "5000",
        TAX_RATE_BPS: "0",
        APP_URL: origin,
        NEXTAUTH_URL: origin,
        AUTH_GOOGLE_ID: "",
        CLOUDINARY_CLOUD_NAME: "",
        CLOUDINARY_API_KEY: "",
        CLOUDINARY_API_SECRET: "",
        PITCHMATE_MEDIA_DIR: mkdtempSync(
          join(tmpdir(), "pitchmate-e2e-media-"),
        ),
        AUTH_GOOGLE_SECRET: "",
        EMAIL_PROVIDER_API_KEY: "",
        EMAIL_FROM: "",
        PITCHMATE_MAIL_DIR: mailDirectory,
      },
    },
  ],
});
