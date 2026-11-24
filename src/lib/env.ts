import { z } from "zod";

const optional = z.preprocess(
  (value) => value || undefined,
  z.string().min(1).optional(),
);
const schema = z
  .object({
    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
    AUTH_SECRET: z.string().min(32),
    APP_URL: z.url({ protocol: /^https?$/ }),
    AUTH_GOOGLE_ID: optional,
    AUTH_GOOGLE_SECRET: optional,
    EMAIL_FROM: optional,
    EMAIL_PROVIDER_API_KEY: optional,
    AUTH_TRUSTED_IP_HEADER: z.preprocess(
      (value) => value || undefined,
      z
        .string()
        .regex(/^[a-z0-9-]+$/)
        .optional(),
    ),
  })
  .superRefine((value, ctx) => {
    if (!URL.canParse(value.APP_URL)) return;
    const origin = new URL(value.APP_URL);
    if (value.APP_URL !== origin.origin) {
      ctx.addIssue({
        code: "custom",
        path: ["APP_URL"],
        message: "Set the canonical origin without a trailing slash.",
      });
    }
    if (Boolean(value.AUTH_GOOGLE_ID) !== Boolean(value.AUTH_GOOGLE_SECRET)) {
      ctx.addIssue({
        code: "custom",
        path: ["AUTH_GOOGLE_ID"],
        message: "Configure both Google credentials.",
      });
    }
    if (Boolean(value.EMAIL_FROM) !== Boolean(value.EMAIL_PROVIDER_API_KEY)) {
      ctx.addIssue({
        code: "custom",
        path: ["EMAIL_FROM"],
        message: "Configure both email settings.",
      });
    }
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(
      origin.hostname,
    );
    if (process.env.NODE_ENV === "production" && !loopback) {
      if (origin.protocol !== "https:") {
        ctx.addIssue({
          code: "custom",
          path: ["APP_URL"],
          message: "A deployed instance requires HTTPS.",
        });
      }
      if (!value.EMAIL_PROVIDER_API_KEY) {
        ctx.addIssue({
          code: "custom",
          path: ["EMAIL_PROVIDER_API_KEY"],
          message: "A deployed instance requires email delivery.",
        });
      }
    }
  });

let configuration: z.infer<typeof schema> | undefined;
export function getEnv() {
  if (!configuration) {
    const result = schema.safeParse(process.env);
    if (!result.success) {
      throw new Error(
        `Invalid PitchMate environment (${result.error.issues.map(({ path }) => path.join(".")).join(", ")}). Check .env.example.`,
      );
    }
    configuration = result.data;
  }
  return configuration;
}
