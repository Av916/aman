import { z } from "zod";
import { validTimezone } from "@/modules/schedules/time";

const schema = z
  .object({
    DEFAULT_TIMEZONE: z.string().refine(validTimezone).default("Asia/Kolkata"),
    DEFAULT_CURRENCY: z.literal("INR").default("INR"),
    SLOT_GENERATION_DAYS: z.coerce.number().int().min(1).max(90).default(30),
    MAX_VENUE_IMAGES: z.coerce.number().int().min(1).max(10).default(10),
    MAX_IMAGE_SIZE_MB: z.coerce.number().int().min(1).max(5).default(5),
    SLOT_JOB_SECRET: z.preprocess(
      (value) => value || undefined,
      z.string().min(32).optional(),
    ),
    CLOUDINARY_CLOUD_NAME: z.preprocess(
      (value) => value || undefined,
      z
        .string()
        .regex(/^[a-zA-Z0-9_-]+$/)
        .optional(),
    ),
    CLOUDINARY_API_KEY: z.preprocess(
      (value) => value || undefined,
      z.string().min(1).optional(),
    ),
    CLOUDINARY_API_SECRET: z.preprocess(
      (value) => value || undefined,
      z.string().min(1).optional(),
    ),
  })
  .refine(
    (value) => {
      const configured = [
        value.CLOUDINARY_CLOUD_NAME,
        value.CLOUDINARY_API_KEY,
        value.CLOUDINARY_API_SECRET,
      ].filter(Boolean).length;
      return configured === 0 || configured === 3;
    },
    {
      message: "Set all three Cloudinary credentials.",
      path: ["CLOUDINARY_CLOUD_NAME"],
    },
  );

export function venueSettings() {
  const result = schema.safeParse(process.env);
  if (!result.success)
    throw new Error(
      `Invalid venue settings (${result.error.issues.map((issue) => issue.path.join(".")).join(", ")}).`,
    );
  return result.data;
}
