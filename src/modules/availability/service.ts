import { AppError } from "@/lib/api";
import { getPrisma } from "@/lib/prisma";
import type { Pitch, Prisma, Venue } from "@/generated/prisma/client";
import { atVenueTime, localDay, shiftDay } from "@/modules/schedules/time";
import {
  pitchMissing,
  lockVenue,
  lockPitch,
} from "@/modules/venues/venue.repository";
import { publicVenueWhere } from "@/modules/venues/venue.types";
import { venueSettings } from "@/modules/venues/settings";
import { generateSlots } from "./generate";

export const protectedStatuses = ["HELD", "BOOKED"] as const;
export const slotFields = {
  id: true,
  startAt: true,
  endAt: true,
  price: true,
  currency: true,
  status: true,
  hourlyPrice: true,
} satisfies Prisma.SlotSelect;

export async function refreshPitch(
  tx: Prisma.TransactionClient,
  pitch: Pitch,
  venue: Pick<Venue, "timezone">,
  strict = true,
  now = new Date(),
) {
  const { SLOT_GENERATION_DAYS: days, DEFAULT_CURRENCY: currency } =
    venueSettings();
  const pitchId = pitch.id;
  const startDay = localDay(now, venue.timezone);
  const upper = atVenueTime(shiftDay(startDay, days), 0, venue.timezone);
  const hours = await tx.operatingHours.findMany({ where: { pitchId } });
  const exceptions = await tx.scheduleException.findMany({
    where: {
      pitchId,
      date: {
        gte: new Date(shiftDay(startDay, -1)),
        lte: new Date(shiftDay(startDay, days)),
      },
    },
  });
  const rules = await tx.pricingRule.findMany({
    where: { pitchId, isActive: true },
  });
  const existing = await tx.slot.findMany({
    where: { pitchId, endAt: { gt: now } },
    select: slotFields,
    orderBy: { startAt: "asc" },
  });
  const candidates = generateSlots({
    pitch,
    hours,
    exceptions,
    rules,
    timezone: venue.timezone,
    startDay,
    days,
    currency,
    now,
  });
  const byStart = new Map(candidates.map((slot) => [+slot.startAt, slot]));
  const locked = existing.filter(
    (slot) => slot.status !== "AVAILABLE" || +slot.startAt < +now,
  );
  if (
    strict &&
    locked.some(
      (slot) =>
        (slot.status === "BOOKED" || slot.status === "HELD") &&
        (!pitch.isActive ||
          (+slot.startAt >= +now &&
            (slot.startAt >= upper ||
              byStart.get(+slot.startAt)?.endAt.getTime() !== +slot.endAt))),
    )
  ) {
    throw new AppError(
      409,
      "PROTECTED_SLOTS",
      "This change would affect held or booked slots.",
    );
  }

  let index = 0;
  const desired = candidates.filter((slot) => {
    while (index < locked.length && +locked[index].endAt <= +slot.startAt)
      index++;
    return index === locked.length || +slot.endAt <= +locked[index].startAt;
  });
  const wanted = new Map(desired.map((slot) => [+slot.startAt, slot]));
  const reusable = new Set<number>();
  const remove: string[] = [];
  for (const slot of existing) {
    if (slot.status !== "AVAILABLE" || slot.startAt < now) continue;
    const pending = wanted.get(+slot.startAt);
    if (
      pending &&
      +pending.endAt === +slot.endAt &&
      pending.price === slot.price &&
      pending.hourlyPrice === slot.hourlyPrice &&
      pending.currency === slot.currency
    ) {
      reusable.add(+slot.startAt);
    } else {
      remove.push(slot.id);
    }
  }
  if (remove.length)
    await tx.slot.deleteMany({
      where: { id: { in: remove }, status: "AVAILABLE" },
    });
  const insert = desired.filter((slot) => !reusable.has(+slot.startAt));
  if (insert.length)
    await tx.slot.createMany({
      data: insert.map((slot) => ({ ...slot, pitchId })),
    });
  return {
    generated: insert.length,
    removed: remove.length,
    preserved: locked.length,
  };
}

export async function pitchAvailability(pitchId: string, date?: string) {
  const pitch = await getPrisma().pitch.findFirst({
    where: { id: pitchId, isActive: true, venue: publicVenueWhere },
    select: { venue: { select: { timezone: true } } },
  });
  if (!pitch) throw pitchMissing();
  const now = new Date();
  const timezone = pitch.venue.timezone;
  const today = localDay(now, timezone);
  const day = date ?? today;
  const maxDate = shiftDay(today, venueSettings().SLOT_GENERATION_DAYS - 1);
  const slots =
    day < today || day > maxDate
      ? []
      : await getPrisma().slot.findMany({
          where: {
            pitchId,
            pitch: { isActive: true, venue: publicVenueWhere },
            startAt: {
              gte: new Date(Math.max(+now, +atVenueTime(day, 0, timezone))),
              lt: atVenueTime(shiftDay(day, 1), 0, timezone),
            },
          },
          orderBy: { startAt: "asc" },
          select: slotFields,
        });
  return { date: day, timezone, today, maxDate, slots };
}

export async function extendAvailability(cursor?: string, size = 10) {
  const database = getPrisma();
  const pitches = await database.pitch.findMany({
    where: {
      id: cursor ? { gt: cursor } : undefined,
      isActive: true,
      venue: {
        deletedAt: null,
        status: { in: ["APPROVED", "PENDING_APPROVAL"] },
      },
    },
    select: { id: true, venueId: true },
    orderBy: { id: "asc" },
    take: size + 1,
  });
  let generated = 0;
  for (const pitch of pitches.slice(0, size)) {
    const result = await database.$transaction(
      async (tx) => {
        const venue = await lockVenue(tx, pitch.venueId);
        if (
          venue.deletedAt ||
          (venue.status !== "APPROVED" && venue.status !== "PENDING_APPROVAL")
        )
          return;
        const locked = await lockPitch(tx, pitch.id);
        if (locked.isActive) return refreshPitch(tx, locked, venue, false);
      },
      { timeout: 20_000 },
    );
    generated += result?.generated ?? 0;
  }
  return {
    generated,
    processed: Math.min(pitches.length, size),
    nextCursor: pitches.length > size ? pitches[size - 1].id : null,
  };
}
