import { getPrisma } from "@/lib/prisma";
import {
  cardVenueSelect,
  publicVenueWhere,
} from "@/modules/venues/venue.types";
import { lockVenue, venueMissing } from "@/modules/venues/venue.repository";

export async function listFavorites(userId: string, page = 1) {
  const database = getPrisma();
  const where = { userId, venue: publicVenueWhere };
  const size = 12;
  const [items, total] = await database.$transaction(
    [
      database.favorite.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        take: size,
        skip: (page - 1) * size,
        select: {
          venue: {
            select: {
              ...cardVenueSelect,
              pitches: {
                where: { isActive: true },
                select: { basePrice: true, pitchType: true },
                orderBy: [{ basePrice: "asc" }, { id: "asc" }],
                take: 1,
              },
            },
          },
        },
      }),
      database.favorite.count({ where }),
    ],
    { isolationLevel: "RepeatableRead" },
  );
  return {
    venues: items.flatMap(
      ({
        venue: {
          pitches: [pitch],
          ...venue
        },
      }) =>
        pitch
          ? [
              {
                ...venue,
                startingPrice: pitch.basePrice,
                pitchType: pitch.pitchType,
                distanceKm: null,
              },
            ]
          : [],
    ),
    pagination: { page, size, total, pages: Math.ceil(total / size) },
  };
}

export async function savedVenueIds(userId: string, venueIds: string[]) {
  if (!venueIds.length) return [];
  const rows = await getPrisma().favorite.findMany({
    where: { userId, venueId: { in: venueIds } },
    select: { venueId: true },
  });
  return rows.map((row) => row.venueId);
}

export async function saveVenue(userId: string, venueId: string) {
  return getPrisma().$transaction(async (tx) => {
    const venue = await lockVenue(tx, venueId);
    if (venue.status !== "APPROVED" || !venue.publishedAt || venue.deletedAt)
      throw venueMissing();
    await tx.favorite.upsert({
      where: { userId_venueId: { userId, venueId } },
      create: { userId, venueId },
      update: {},
    });
  });
}

export function unsaveVenue(userId: string, venueId: string) {
  return getPrisma().favorite.deleteMany({ where: { userId, venueId } });
}
