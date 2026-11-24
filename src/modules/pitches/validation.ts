import { z } from "zod";
import { PitchType, SurfaceType } from "@/generated/prisma/enums";
import { paise } from "@/modules/pricing/validation";
import { idSchema } from "@/modules/venues/venue.validation";

export const duration = z.union([z.literal(30), z.literal(60)]);
export const pitchFields = z.strictObject({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(1000).optional(),
  pitchType: z.enum(PitchType),
  surfaceType: z.enum(SurfaceType),
  isIndoor: z.boolean().optional(),
  capacity: z.number().int().min(1).max(500),
  lengthInMeters: z.number().int().min(1).max(250),
  widthInMeters: z.number().int().min(1).max(250),
  basePrice: paise,
  slotDurationMinutes: duration.optional(),
  minimumBookingMinutes: z.number().int().min(30).max(1440).optional(),
  maximumBookingMinutes: z.number().int().min(30).max(1440).optional(),
  isActive: z.boolean().optional(),
});
export const pitchUpdate = pitchFields
  .partial()
  .refine(
    (value) => Object.keys(value).length > 0,
    "Supply a pitch field to update.",
  );
export const slotMutation = z.strictObject({
  slotIds: z
    .array(idSchema)
    .min(1)
    .max(96)
    .refine(
      (ids) => new Set(ids).size === ids.length,
      "Select each slot once.",
    ),
});

export function checkDurations(values: {
  slotDurationMinutes: number;
  minimumBookingMinutes: number;
  maximumBookingMinutes: number;
}) {
  const {
    slotDurationMinutes: slot,
    minimumBookingMinutes: min,
    maximumBookingMinutes: max,
  } = values;
  if (min < slot || max < min || min % slot || max % slot)
    throw new z.ZodError([
      {
        code: "custom",
        path: ["minimumBookingMinutes"],
        message:
          "Booking limits must be ordered multiples of the slot duration.",
      },
    ]);
}
