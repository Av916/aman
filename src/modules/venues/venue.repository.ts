import { Prisma } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { AppError } from "@/lib/api";
import {
  cardVenueSelect,
  managementInclude,
  publicDetailSelect,
  publicVenueWhere,
} from "./venue.types";
import { venueSettings } from "./settings";
import type { DiscoveryQuery } from "./venue.validation";

export const venueMissing = () =>
  new AppError(404, "VENUE_NOT_FOUND", "Venue not found.");
export const pitchMissing = () =>
  new AppError(404, "PITCH_NOT_FOUND", "Pitch not found.");

export function managedVenue(id: string, ownerId?: string) {
  return getPrisma().venue.findFirst({
    where: { id, ownerId },
    include: managementInclude,
  });
}
export function publicVenue(slug: string) {
  return getPrisma().venue.findFirst({
    where: { ...publicVenueWhere, slug },
    select: publicDetailSelect,
  });
}

export async function lockVenue(
  tx: Prisma.TransactionClient,
  id: string,
  ownerId?: string,
) {
  const owner = ownerId
    ? Prisma.sql`AND "ownerId" = ${ownerId}::uuid`
    : Prisma.empty;
  const [row] = await tx.$queryRaw<
    { id: string }[]
  >`SELECT id FROM "Venue" WHERE id = ${id}::uuid ${owner} FOR UPDATE`;
  if (!row) throw venueMissing();
  return tx.venue.findUniqueOrThrow({ where: { id } });
}

export async function lockPitch(tx: Prisma.TransactionClient, pitchId: string) {
  const [row] = await tx.$queryRaw<
    { id: string }[]
  >`SELECT id FROM "Pitch" WHERE id = ${pitchId}::uuid FOR UPDATE`;
  if (!row) throw pitchMissing();
  return tx.pitch.findUniqueOrThrow({ where: { id: pitchId } });
}

export function venueAudit(
  tx: Prisma.TransactionClient,
  actorId: string,
  venueId: string,
  action: string,
  metadata?: Prisma.InputJsonValue,
) {
  return tx.auditLog.create({
    data: { actorId, entityType: "Venue", entityId: venueId, action, metadata },
  });
}

export async function listManagedVenues(
  query: { q: string; status?: Prisma.VenueWhereInput["status"]; page: number },
  ownerId?: string,
) {
  const { q, page, status } = query;
  const text = { contains: q, mode: "insensitive" as const };
  const where = {
    ownerId,
    status,
    OR: q
      ? [
          { name: text },
          { city: text },
          ...(!ownerId
            ? [{ owner: { OR: [{ name: text }, { email: text }] } }]
            : []),
        ]
      : undefined,
  } satisfies Prisma.VenueWhereInput;
  const size = 12;
  const database = getPrisma();
  const [venues, total] = await database.$transaction(
    [
      database.venue.findMany({
        where,
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        skip: (page - 1) * size,
        take: size,
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          city: true,
          locality: true,
          publishedAt: true,
          updatedAt: true,
          _count: { select: { pitches: true } },
          ...(!ownerId
            ? { owner: { select: { id: true, name: true, email: true } } }
            : {}),
        },
      }),
      database.venue.count({ where }),
    ],
    { isolationLevel: "RepeatableRead" },
  );
  return {
    venues,
    pagination: { page, size, total, pages: Math.ceil(total / size) },
  };
}

const visibility = Prisma.sql`v."status" = 'APPROVED' AND v."publishedAt" IS NOT NULL AND v."deletedAt" IS NULL`;
const searchVector = Prisma.sql`to_tsvector('simple', v."name" || ' ' || v."city" || ' ' || v."locality" || ' ' || v."address")`;
const matches = (field: Prisma.Sql, value: string) =>
  Prisma.sql`strpos(lower(${field}), lower(${value})) > 0`;
const rateFilters = (rate: Prisma.Sql, q: DiscoveryQuery) => [
  ...(q.minPrice === undefined
    ? []
    : [Prisma.sql`${rate} >= ${q.minPrice}::int`]),
  ...(q.maxPrice === undefined
    ? []
    : [Prisma.sql`${rate} <= ${q.maxPrice}::int`]),
];

export async function discoverVenues(query: DiscoveryQuery, exclude?: string) {
  const q = query;
  const size = 12;
  const filters = [visibility];
  const pitchFilters = [Prisma.sql`p."venueId" = v.id AND p."isActive"`];
  const search = Prisma.sql`websearch_to_tsquery('simple', ${q.q})`;
  const pitchTypeSearch = Prisma.sql`p."pitchType"::text LIKE ${
    "%" +
    q.q
      .toUpperCase()
      .replace(/[^A-Z0-9 ]/g, "")
      .trim()
      .replace(/ +/g, "_") +
    "%"
  } ESCAPE ''`;
  if (q.q) {
    const pitchSearch = /[a-z0-9]/i.test(q.q)
      ? Prisma.sql`OR ${pitchTypeSearch}`
      : Prisma.empty;
    pitchFilters.push(
      Prisma.sql`(${searchVector} @@ ${search} OR ${matches(Prisma.sql`v.name`, q.q)} OR ${matches(Prisma.sql`v.address`, q.q)} OR ${matches(Prisma.sql`v.city`, q.q)} OR ${matches(Prisma.sql`v.locality`, q.q)} ${pitchSearch})`,
    );
  }
  if (q.city) filters.push(Prisma.sql`lower(v.city) = lower(${q.city})`);
  if (q.locality) filters.push(matches(Prisma.sql`v.locality`, q.locality));
  if (exclude) filters.push(Prisma.sql`v.id <> ${exclude}::uuid`);
  for (const slug of new Set(q.amenities)) {
    filters.push(
      Prisma.sql`EXISTS (SELECT 1 FROM "VenueAmenity" va JOIN "Amenity" a ON a.id = va."amenityId" WHERE va."venueId" = v.id AND a.slug = ${slug} AND a."isActive")`,
    );
  }
  if (q.pitchType)
    pitchFilters.push(Prisma.sql`p."pitchType" = ${q.pitchType}::"PitchType"`);
  if (q.surfaceType)
    pitchFilters.push(
      Prisma.sql`p."surfaceType" = ${q.surfaceType}::"SurfaceType"`,
    );
  if (q.capacity)
    pitchFilters.push(Prisma.sql`p.capacity >= ${q.capacity}::int`);
  if (q.setting)
    pitchFilters.push(Prisma.sql`p."isIndoor" = ${q.setting === "indoor"}`);

  const availableSlots = q.date
    ? Prisma.sql`
    JOIN LATERAL (
      SELECT min(s."hourlyPrice") AS rate FROM "Slot" s
      WHERE ${Prisma.join(
        [
          Prisma.sql`s."pitchId" = p.id AND s.status = 'AVAILABLE' AND s."startAt" >= now()`,
          Prisma.sql`${q.date}::date < ((now() AT TIME ZONE v.timezone)::date + ${venueSettings().SLOT_GENERATION_DAYS}::int)`,
          Prisma.sql`s."startAt" >= (${q.date}::date::timestamp AT TIME ZONE v.timezone)`,
          ...(q.from
            ? [
                Prisma.sql`((s."startAt" AT TIME ZONE v.timezone)::time) >= ${q.from}::time`,
              ]
            : []),
          Prisma.sql`s."startAt" < (((${q.date}::date + 1)::timestamp) AT TIME ZONE v.timezone)`,
          ...(q.until
            ? [
                Prisma.sql`(s."endAt" AT TIME ZONE v.timezone) <= (${q.date}::date + ${q.until}::time)`,
              ]
            : []),
          ...rateFilters(Prisma.sql`s."hourlyPrice"`, q),
        ],
        " AND ",
      )}
    ) slot ON slot.rate IS NOT NULL`
    : Prisma.empty;

  const rate = q.date ? Prisma.sql`slot.rate` : Prisma.sql`p."basePrice"`;
  const distance =
    q.lat === undefined
      ? Prisma.sql`NULL::float8`
      : Prisma.sql`
    CASE WHEN v.latitude IS NOT NULL THEN
      6371 * acos(least(1.0, greatest(-1.0,
        sin(radians(${q.lat}::float8)) * sin(radians(v.latitude)) +
        cos(radians(${q.lat}::float8)) * cos(radians(v.latitude)) * cos(radians(v.longitude - ${q.lng}::float8))
      ))) END`;
  const rank = q.q
    ? Prisma.sql`ts_rank(${searchVector}, ${search})`
    : Prisma.sql`0`;
  const sorts = {
    relevance: Prisma.sql`rank DESC, published DESC`,
    "price-asc": Prisma.sql`price ASC`,
    "price-desc": Prisma.sql`price DESC`,
    recent: Prisma.sql`published DESC`,
    name: Prisma.sql`lower(name) ASC`,
    distance: Prisma.sql`distance ASC NULLS LAST`,
  };
  const database = getPrisma();
  return database.$transaction(
    async (tx) => {
      const eligible = Prisma.sql`
      SELECT v.id, v.name, v."publishedAt" AS published, eligible.price, eligible.type, ${rank} AS rank, ${distance} AS distance
      FROM "Venue" v
      JOIN LATERAL (
        SELECT ${rate} AS price, p."pitchType"::text AS type
        FROM "Pitch" p ${availableSlots}
        WHERE ${Prisma.join(q.date ? pitchFilters : [...pitchFilters, ...rateFilters(rate, q)], " AND ")}
        ORDER BY price, p.id LIMIT 1
      ) eligible ON true
      WHERE ${Prisma.join(filters, " AND ")}
    `;
      const rows = await tx.$queryRaw<
        { id: string; price: number; type: string; distance: number | null }[]
      >`
      WITH eligible AS (${eligible})
      SELECT id, price, type, distance FROM eligible ORDER BY ${sorts[q.sort]}, id LIMIT ${size} OFFSET ${(q.page - 1) * size}
    `;
      const [{ total }] = await tx.$queryRaw<
        { total: number }[]
      >`SELECT count(*)::int AS total FROM (${eligible}) matches`;
      const venues = await tx.venue.findMany({
        where: { id: { in: rows.map((row) => row.id) } },
        select: cardVenueSelect,
      });
      const byId = new Map(venues.map((item) => [item.id, item]));
      return {
        venues: rows.flatMap((row) => {
          const venue = byId.get(row.id);
          return venue
            ? [
                {
                  ...venue,
                  startingPrice: row.price,
                  pitchType: row.type,
                  distanceKm: row.distance,
                },
              ]
            : [];
        }),
        pagination: {
          page: q.page,
          size,
          total,
          pages: Math.ceil(total / size),
        },
      };
    },
    { isolationLevel: "RepeatableRead" },
  );
}

export function ownerVenueCounts(ownerId: string) {
  const database = getPrisma();
  return Promise.all([
    database.venue.count({ where: { ownerId, deletedAt: null } }),
    database.venue.count({ where: { ownerId, ...publicVenueWhere } }),
    database.venue.count({
      where: { ownerId, deletedAt: null, status: "PENDING_APPROVAL" },
    }),
  ]);
}
