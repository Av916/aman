import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { getPrisma } from "@/lib/prisma";
import {
  publicPresentationSelect,
  publicPitchSelect,
  publicVenueWhere,
} from "./venue.types";

// A fresh visibility check supplies the key. An edit or publication transition
// changes the revision, so a stale cache entry cannot make a hidden venue public.
const presentation = unstable_cache(
  (id: string, revision: string) =>
    getPrisma().venue.findFirst({
      where: { id, updatedAt: new Date(revision), ...publicVenueWhere },
      select: publicPresentationSelect,
    }),
  ["pitchmate-public-venue-presentation"],
  { revalidate: 120 },
);

export const publicVenueView = cache(async (slug: string) => {
  const database = getPrisma();
  const venue = await database.venue.findFirst({
    where: { ...publicVenueWhere, slug },
    select: { id: true, updatedAt: true },
  });
  if (!venue) return null;
  const details = await presentation(venue.id, venue.updatedAt.toISOString());
  if (!details) return null;
  const pitches = await database.pitch.findMany({
    where: { venueId: venue.id, isActive: true },
    select: publicPitchSelect,
    orderBy: [{ basePrice: "asc" }, { id: "asc" }],
  });
  return { ...details, pitches };
});
