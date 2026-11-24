import type { MetadataRoute } from "next";
import { getPrisma } from "@/lib/prisma";
import { getEnv } from "@/lib/env";
import { publicVenueWhere } from "@/modules/venues/venue.types";

export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (process.env.APP_ENV === "staging") return [];
  const origin = getEnv().APP_URL;
  const venues = await getPrisma().venue.findMany({
    where: { ...publicVenueWhere, pitches: { some: { isActive: true } } },
    select: { slug: true, updatedAt: true },
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    take: 45000,
  });
  return [
    ...[
      "/",
      "/turfs",
      "/privacy",
      "/terms",
      "/refund-policy",
      "/cancellation-policy",
      "/contact",
    ].map((path) => ({ url: new URL(path, origin).href })),
    ...venues.map((venue) => ({
      url: new URL(`/turfs/${venue.slug}`, origin).href,
      lastModified: venue.updatedAt,
    })),
  ];
}
