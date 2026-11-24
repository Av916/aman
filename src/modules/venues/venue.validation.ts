import { z } from "zod";
import { PitchType, SurfaceType, VenueStatus } from "@/generated/prisma/enums";
import { phone } from "@/modules/auth/schemas";
import { paise } from "@/modules/pricing/validation";
import { validTimezone } from "@/modules/schedules/time";

export const idSchema = z.uuid();
const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .refine(
      (value) => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(value),
      "Remove control characters.",
    );
const venueFields = z.strictObject({
  name: z.string().trim().min(2).max(100),
  description: text(2500).optional(),
  address: text(200).optional(),
  locality: text(100).optional(),
  city: text(100).optional(),
  state: text(100).optional(),
  country: text(100).optional(),
  postalCode: text(20).optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  contactPhone: z.union([phone, z.literal("")]).optional(),
  contactEmail: z.union([z.email().max(254), z.literal("")]).optional(),
  timezone: z
    .string()
    .max(80)
    .refine(validTimezone, "Use a valid IANA timezone.")
    .optional(),
  amenityIds: z
    .array(idSchema)
    .max(30)
    .refine(
      (ids) => new Set(ids).size === ids.length,
      "Amenities must be unique.",
    )
    .optional(),
});

function coordinatePair(data: {
  latitude?: number | null;
  longitude?: number | null;
}) {
  return (
    (data.latitude === undefined && data.longitude === undefined) ||
    (data.latitude === null && data.longitude === null) ||
    (typeof data.latitude === "number" && typeof data.longitude === "number")
  );
}
export const venueCreate = venueFields.refine(
  coordinatePair,
  "Supply latitude and longitude together.",
);
export const venueUpdate = venueFields
  .partial()
  .refine(coordinatePair, "Supply latitude and longitude together.")
  .refine(
    (value) => Object.keys(value).length > 0,
    "Supply a field to update.",
  );

export const venueListQuery = z.object({
  q: text(100).default(""),
  status: z.enum(VenueStatus).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
});

const numberQuery = (schema: z.ZodNumber) =>
  z.preprocess(
    (value) =>
      value === "" || value === undefined ? undefined : Number(value),
    schema.optional(),
  );
export const discoveryQuery = z
  .object({
    q: text(100).default(""),
    city: text(100).default(""),
    locality: text(100).default(""),
    minPrice: numberQuery(paise),
    maxPrice: numberQuery(paise),
    pitchType: z.enum(PitchType).optional(),
    surfaceType: z.enum(SurfaceType).optional(),
    setting: z.enum(["indoor", "outdoor"]).optional(),
    capacity: numberQuery(z.number().int().min(1).max(500)),
    date: z.iso.date().optional(),
    from: z
      .string()
      .regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/)
      .optional(),
    until: z
      .string()
      .regex(/^(?:(?:[01]\d|2[0-3]):[0-5]\d|24:00)$/)
      .optional(),
    amenities: z.preprocess(
      (value) =>
        typeof value === "string" ? value.split(",").filter(Boolean) : [],
      z.array(z.string().regex(/^[a-z0-9-]{1,60}$/)).max(12),
    ),
    sort: z
      .enum([
        "relevance",
        "price-asc",
        "price-desc",
        "recent",
        "name",
        "distance",
      ])
      .default("relevance"),
    lat: numberQuery(z.number().min(-90).max(90)),
    lng: numberQuery(z.number().min(-180).max(180)),
    page: z.coerce.number().int().min(1).max(1000).default(1),
  })
  .superRefine((data, ctx) => {
    if ((data.minPrice ?? 0) > (data.maxPrice ?? Infinity))
      ctx.addIssue({
        code: "custom",
        path: ["maxPrice"],
        message: "Maximum price must be at least the minimum.",
      });
    if ((data.from || data.until) && !data.date)
      ctx.addIssue({
        code: "custom",
        path: ["date"],
        message: "Choose a date to filter by time.",
      });
    if (data.from && data.until && data.from >= data.until)
      ctx.addIssue({
        code: "custom",
        path: ["until"],
        message: "End time must be after start time.",
      });
    if (
      (data.lat === undefined) !== (data.lng === undefined) ||
      (data.sort === "distance" && data.lat === undefined)
    )
      ctx.addIssue({
        code: "custom",
        path: ["lat"],
        message: "Distance sorting requires both coordinates.",
      });
  });
export type DiscoveryQuery = z.output<typeof discoveryQuery>;

export const publicSlug = z.string().regex(/^[a-z0-9-]{1,140}$/);
export const dayQuery = z.object({ date: z.iso.date().optional() });
export const rejectVenueInput = z.strictObject({
  reason: text(500).refine(
    (value) => value.length >= 5,
    "Enter a reason with at least five characters.",
  ),
});
export const favoriteInput = z.strictObject({ venueId: idSchema });
