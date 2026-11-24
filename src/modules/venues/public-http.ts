import { endpoint, success } from "@/lib/api";
import { getPrisma } from "@/lib/prisma";
import { listAmenities } from "@/modules/amenities/service";
import { pitchAvailability } from "@/modules/availability/service";
import { discoverVenues, venueMissing } from "./venue.repository";
import { publicVenueView } from "./public-view";
import { publicVenueWhere } from "./venue.types";
import {
  dayQuery,
  discoveryQuery,
  idSchema,
  publicSlug,
} from "./venue.validation";
import { query, throttleDiscovery } from "./http";

export async function listCities() {
  const groups = await getPrisma().venue.groupBy({
    by: ["city"],
    where: {
      ...publicVenueWhere,
      city: { not: "" },
      pitches: { some: { isActive: true } },
    },
    orderBy: { city: "asc" },
    take: 200,
    _count: { _all: true },
  });
  return groups.map(({ city, _count }) => ({ city, count: _count._all }));
}

export const venuesGet = endpoint(async (r) => {
  await throttleDiscovery(r.headers);
  return success(
    "Venues loaded.",
    await discoverVenues(query(r, discoveryQuery)),
  );
});

export function publicVenueRoute(pitchesOnly: boolean) {
  return endpoint(
    async (r: Request, { params }: { params: Promise<{ slug: string }> }) => {
      await throttleDiscovery(r.headers);
      const venue = await publicVenueView(
        publicSlug.parse((await params).slug),
      );
      if (!venue) throw venueMissing();
      return success(
        "Venue loaded.",
        pitchesOnly ? { pitches: venue.pitches } : { venue },
      );
    },
  );
}

export const availabilityGet = endpoint(
  async (r: Request, { params }: { params: Promise<{ pitchId: string }> }) => {
    await throttleDiscovery(r.headers);
    return success(
      "Availability loaded.",
      await pitchAvailability(
        idSchema.parse((await params).pitchId),
        query(r, dayQuery).date,
      ),
    );
  },
);

export const amenitiesGet = endpoint(async (r) => {
  await throttleDiscovery(r.headers);
  return success("Amenities loaded.", { amenities: await listAmenities() });
});

export const citiesGet = endpoint(async (r) => {
  await throttleDiscovery(r.headers);
  return success("Cities loaded.", { cities: await listCities() });
});
