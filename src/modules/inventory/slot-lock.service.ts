import { Prisma, type Pitch, type Venue } from "@/generated/prisma/client";
import { unavailable } from "@/modules/bookings/booking.state-machine";

type LockedOffer = Pitch & {
  venueName: string;
  venueAddress: string;
  venueLocality: string;
  venueCity: string;
  venueState: string;
  venueTimezone: string;
  venuePublishedAt: Date;
};

export async function lockBookablePitch(
  tx: Prisma.TransactionClient,
  pitchId: string,
  slotIds: string[],
) {
  if (!slotIds.length) throw unavailable();
  const selected = Prisma.join(slotIds.map((id) => Prisma.sql`${id}::uuid`));
  // Materialize the venue lock before attempting the pitch lock.
  const [pitch] = await tx.$queryRaw<LockedOffer[]>`
    WITH locked_venue AS MATERIALIZED (
      SELECT v.* FROM "Venue" v
      WHERE v.id = (SELECT p."venueId" FROM "Pitch" p WHERE p.id = ${pitchId}::uuid)
        AND v.status = 'APPROVED' AND v."publishedAt" IS NOT NULL AND v."deletedAt" IS NULL
      FOR SHARE OF v SKIP LOCKED
    )
    SELECT p.*, v.name AS "venueName", v.address AS "venueAddress", v.locality AS "venueLocality",
      v.city AS "venueCity", v.state AS "venueState", v.timezone AS "venueTimezone", v."publishedAt" AS "venuePublishedAt"
    FROM locked_venue v
    JOIN LATERAL (
      SELECT p.* FROM "Pitch" p
      WHERE p.id = ${pitchId}::uuid AND p."venueId" = v.id AND p."isActive"
        AND (SELECT count(*) FROM "Slot" s WHERE s."pitchId" = p.id
          AND s.id IN (${selected}) AND s.status = 'AVAILABLE' AND s."activeBookingId" IS NULL) = ${slotIds.length}::int
      FOR UPDATE OF p SKIP LOCKED
    ) p ON true
  `;
  if (!pitch) throw unavailable();
  const venue = {
    id: pitch.venueId,
    name: pitch.venueName,
    address: pitch.venueAddress,
    locality: pitch.venueLocality,
    city: pitch.venueCity,
    state: pitch.venueState,
    timezone: pitch.venueTimezone,
    publishedAt: pitch.venuePublishedAt,
    deletedAt: null,
    status: "APPROVED",
  } satisfies Pick<
    Venue,
    | "id"
    | "name"
    | "address"
    | "locality"
    | "city"
    | "state"
    | "timezone"
    | "publishedAt"
    | "deletedAt"
    | "status"
  >;
  return { venue, pitch };
}

export async function holdSlots(
  tx: Prisma.TransactionClient,
  pitchId: string,
  bookingId: string,
  slotIds: string[],
  until: Date,
  now: Date,
) {
  const result = await tx.slot.updateMany({
    where: {
      pitchId,
      id: { in: slotIds },
      status: "AVAILABLE",
      activeBookingId: null,
      startAt: { gt: now },
    },
    data: { activeBookingId: bookingId, status: "HELD", holdExpiresAt: until },
  });
  if (result.count !== slotIds.length) throw unavailable();
}
