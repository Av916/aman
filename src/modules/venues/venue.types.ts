import type { Prisma } from "@/generated/prisma/client";

export const publicVenueWhere = {
  status: "APPROVED",
  publishedAt: { not: null },
  deletedAt: null,
} satisfies Prisma.VenueWhereInput;

export const publicImageSelect = {
  id: true,
  imageUrl: true,
  altText: true,
  isCover: true,
  sortOrder: true,
} satisfies Prisma.VenueImageSelect;

export const publicPitchSelect = {
  id: true,
  name: true,
  description: true,
  pitchType: true,
  surfaceType: true,
  isIndoor: true,
  capacity: true,
  lengthInMeters: true,
  widthInMeters: true,
  basePrice: true,
  slotDurationMinutes: true,
  minimumBookingMinutes: true,
  maximumBookingMinutes: true,
  hours: {
    select: {
      dayOfWeek: true,
      openingTime: true,
      closingTime: true,
      isClosed: true,
    },
    orderBy: [{ dayOfWeek: "asc" }, { openingTime: "asc" }],
  },
} satisfies Prisma.PitchSelect;

export const cardVenueSelect = {
  id: true,
  slug: true,
  name: true,
  city: true,
  locality: true,
  state: true,
  latitude: true,
  longitude: true,
  images: {
    select: publicImageSelect,
    orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }],
    take: 1,
  },
  amenities: {
    where: { amenity: { isActive: true } },
    select: { amenity: { select: { name: true, slug: true } } },
  },
} satisfies Prisma.VenueSelect;

export const publicPresentationSelect = {
  ...cardVenueSelect,
  description: true,
  address: true,
  country: true,
  postalCode: true,
  timezone: true,
  contactPhone: true,
  contactEmail: true,
  images: {
    select: publicImageSelect,
    orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }],
  },
} satisfies Prisma.VenueSelect;

export const publicDetailSelect = {
  ...publicPresentationSelect,
  pitches: {
    where: { isActive: true },
    select: publicPitchSelect,
    orderBy: [{ basePrice: "asc" }, { id: "asc" }],
  },
} satisfies Prisma.VenueSelect;

export const managementInclude = {
  images: { select: publicImageSelect, orderBy: { sortOrder: "asc" } },
  amenities: { select: { amenity: true } },
  pitches: {
    orderBy: { createdAt: "asc" },
    include: {
      hours: { orderBy: [{ dayOfWeek: "asc" }, { openingTime: "asc" }] },
      exceptions: { orderBy: { date: "asc" } },
      pricingRules: { orderBy: [{ priority: "desc" }, { id: "asc" }] },
    },
  },
} satisfies Prisma.VenueInclude;

export type VenueCard = Prisma.VenueGetPayload<{
  select: typeof cardVenueSelect;
}> & {
  startingPrice: number;
  pitchType: string;
  distanceKm: number | null;
};
export type PublicVenue = Prisma.VenueGetPayload<{
  select: typeof publicDetailSelect;
}>;
export type ManagedVenue = Prisma.VenueGetPayload<{
  include: typeof managementInclude;
}>;
