import { z } from "zod";
import { AppError } from "@/lib/api";
import type { Pitch, Prisma, Venue } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import {
  lockPitch,
  lockVenue,
  pitchMissing,
  venueAudit,
} from "@/modules/venues/venue.repository";
import {
  assertEditable,
  conflict,
  reapproveAfterEdit,
} from "@/modules/venues/venue.service";
import { refreshPitch, slotFields } from "@/modules/availability/service";
import {
  atVenueTime,
  civilDate,
  dayString,
  localDay,
  shiftDay,
} from "@/modules/schedules/time";
import type {
  exceptionInput,
  weeklySchedule,
} from "@/modules/schedules/validation";
import { pricingData, pricingInput } from "@/modules/pricing/validation";
import { ambiguousRules } from "@/modules/pricing/resolve";
import {
  checkDurations,
  type pitchFields,
  type pitchUpdate,
} from "./validation";

type Inputs = z.output<typeof pitchFields>;
type Changes = z.output<typeof pitchUpdate>;
const protectedConflict = () =>
  conflict(
    "The selected slots include held or booked slots.",
    "PROTECTED_SLOTS",
  );

export async function ownerPitch(ownerId: string, pitchId: string) {
  const pitch = await getPrisma().pitch.findFirst({
    where: { id: pitchId, venue: { ownerId } },
    include: { venue: { select: { id: true, timezone: true, status: true } } },
  });
  if (!pitch) throw pitchMissing();
  return pitch;
}

async function mutatePitch<T>(
  ownerId: string,
  pitchId: string,
  action: (
    tx: Prisma.TransactionClient,
    pitch: Pitch,
    venue: Venue,
  ) => Promise<T>,
) {
  return getPrisma().$transaction(
    async (tx) => {
      const matching = await tx.pitch.findFirst({
        where: { id: pitchId, venue: { ownerId } },
        select: { venueId: true },
      });
      if (!matching) throw pitchMissing();
      const venue = await lockVenue(tx, matching.venueId, ownerId);
      assertEditable(venue);
      return action(tx, await lockPitch(tx, pitchId), venue);
    },
    { timeout: 20_000 },
  );
}

export async function addPitch(
  ownerId: string,
  venueId: string,
  input: Inputs,
) {
  const slotDurationMinutes = input.slotDurationMinutes ?? 60;
  const data = {
    ...input,
    slotDurationMinutes,
    minimumBookingMinutes: input.minimumBookingMinutes ?? slotDurationMinutes,
    maximumBookingMinutes: input.maximumBookingMinutes ?? 180,
    isIndoor: input.pitchType === "INDOOR_CRICKET" || (input.isIndoor ?? false),
  };
  checkDurations(data);
  return getPrisma().$transaction(async (tx) => {
    const venue = await lockVenue(tx, venueId, ownerId);
    assertEditable(venue);
    if ((await tx.pitch.count({ where: { venueId } })) >= 20)
      throw conflict("A venue can have up to 20 pitches.", "PITCH_LIMIT");
    const pitch = await tx.pitch.create({ data: { ...data, venueId } });
    await reapproveAfterEdit(tx, venue);
    await venueAudit(tx, ownerId, venue.id, "PITCH_CREATED", {
      pitchId: pitch.id,
    });
    return pitch;
  });
}

export function editPitch(ownerId: string, id: string, input: Changes) {
  return mutatePitch(ownerId, id, async (tx, before, venue) => {
    const data = { ...input };
    if ((data.pitchType ?? before.pitchType) === "INDOOR_CRICKET")
      data.isIndoor = true;
    checkDurations({ ...before, ...data });
    const changes = Object.entries(data).filter(
      ([key, value]) => before[key as keyof Pitch] !== value,
    );
    if (!changes.length) return before;
    const pitch = await tx.pitch.update({ where: { id }, data });
    if (
      changes.some(([key]) =>
        ["slotDurationMinutes", "basePrice", "isActive"].includes(key),
      )
    )
      await refreshPitch(
        tx,
        pitch,
        venue,
        changes.some(([key]) =>
          ["slotDurationMinutes", "isActive"].includes(key),
        ),
      );
    if (
      changes.some(
        ([key]) =>
          ![
            "basePrice",
            "slotDurationMinutes",
            "minimumBookingMinutes",
            "maximumBookingMinutes",
          ].includes(key),
      )
    )
      await reapproveAfterEdit(tx, venue);
    await venueAudit(tx, ownerId, venue.id, "PITCH_EDITED", { pitchId: id });
    return pitch;
  });
}

export function setWeeklySchedule(
  ownerId: string,
  pitchId: string,
  input: z.output<typeof weeklySchedule>,
) {
  return mutatePitch(ownerId, pitchId, async (tx, pitch, venue) => {
    await tx.operatingHours.deleteMany({ where: { pitchId } });
    await tx.operatingHours.createMany({
      data: input.hours.map((row) => ({ ...row, pitchId })),
    });
    await refreshPitch(tx, pitch, venue);
    await venueAudit(tx, ownerId, venue.id, "WEEKLY_SCHEDULE_UPDATED", {
      pitchId,
    });
    return tx.operatingHours.findMany({
      where: { pitchId },
      orderBy: [{ dayOfWeek: "asc" }, { openingTime: "asc" }],
    });
  });
}

export function addException(
  ownerId: string,
  pitchId: string,
  { date, ...input }: z.output<typeof exceptionInput>,
) {
  return mutatePitch(ownerId, pitchId, async (tx, pitch, venue) => {
    if (date < localDay(new Date(), venue.timezone))
      throw conflict(
        "Schedule exceptions must be today or later.",
        "PAST_EXCEPTION",
      );
    const entry = await tx.scheduleException.create({
      data: { ...input, pitchId, date: civilDate(date) },
    });
    await refreshPitch(tx, pitch, venue);
    await venueAudit(tx, ownerId, venue.id, "SCHEDULE_EXCEPTION_CREATED", {
      pitchId,
      date,
    });
    return entry;
  });
}

export function removeException(
  ownerId: string,
  pitchId: string,
  exceptionId: string,
) {
  return mutatePitch(ownerId, pitchId, async (tx, pitch, venue) => {
    const { count } = await tx.scheduleException.deleteMany({
      where: { id: exceptionId, pitchId },
    });
    if (!count)
      throw new AppError(
        404,
        "EXCEPTION_NOT_FOUND",
        "Schedule exception not found.",
      );
    await refreshPitch(tx, pitch, venue);
    await venueAudit(tx, ownerId, venue.id, "SCHEDULE_EXCEPTION_REMOVED", {
      pitchId,
      exceptionId,
    });
  });
}

export function writePricing(
  ownerId: string,
  pitchId: string,
  input: Record<string, unknown> | undefined,
  ruleId?: string,
) {
  return mutatePitch(ownerId, pitchId, async (tx, pitch, venue) => {
    const rules = await tx.pricingRule.findMany({ where: { pitchId } });
    const previous = ruleId
      ? rules.find((rule) => rule.id === ruleId)
      : undefined;
    if (ruleId && !previous)
      throw new AppError(404, "RULE_NOT_FOUND", "Pricing rule not found.");
    let result;
    if (!input && previous) {
      result = await tx.pricingRule.delete({ where: { id: previous.id } });
    } else {
      if (!ruleId && rules.length >= 50)
        throw conflict(
          "A pitch can have up to 50 pricing rules.",
          "RULE_LIMIT",
        );
      const base = previous
        ? {
            name: previous.name,
            ruleType: previous.ruleType,
            daysOfWeek: previous.daysOfWeek,
            startTime: previous.startTime,
            endTime: previous.endTime,
            priority: previous.priority,
            pricePerHour: previous.pricePerHour,
            isActive: previous.isActive,
            effectiveFrom: previous.effectiveFrom
              ? dayString(previous.effectiveFrom)
              : null,
            effectiveUntil: previous.effectiveUntil
              ? dayString(previous.effectiveUntil)
              : null,
          }
        : {};
      const data = pricingData(pricingInput.parse({ ...base, ...input }));
      if (
        rules.some((rule) => rule.id !== ruleId && ambiguousRules(rule, data))
      )
        throw conflict(
          "Another active rule covers the same time at this priority.",
          "AMBIGUOUS_PRICING",
        );
      result = ruleId
        ? await tx.pricingRule.update({ where: { id: ruleId }, data })
        : await tx.pricingRule.create({ data: { ...data, pitchId } });
    }
    await refreshPitch(tx, pitch, venue, false);
    await venueAudit(
      tx,
      ownerId,
      venue.id,
      input ? "PRICING_UPDATED" : "PRICING_REMOVED",
      { pitchId, ruleId: result.id },
    );
    return result;
  });
}

export async function pricingPitchId(ownerId: string, ruleId: string) {
  const rule = await getPrisma().pricingRule.findFirst({
    where: { id: ruleId, pitch: { venue: { ownerId } } },
    select: { pitchId: true },
  });
  if (!rule)
    throw new AppError(404, "RULE_NOT_FOUND", "Pricing rule not found.");
  return rule.pitchId;
}

export async function ownerSlots(
  ownerId: string,
  pitchId: string,
  date?: string,
) {
  const pitch = await ownerPitch(ownerId, pitchId);
  const timezone = pitch.venue.timezone;
  const now = Date.now();
  const day = date ?? localDay(new Date(now), timezone);
  const slots = await getPrisma().slot.findMany({
    where: {
      pitchId,
      startAt: {
        gte: atVenueTime(day, 0, timezone),
        lt: atVenueTime(shiftDay(day, 1), 0, timezone),
      },
    },
    select: slotFields,
    orderBy: { startAt: "asc" },
  });
  return { date: day, timezone, slots, now };
}

export function generateOwnerSlots(ownerId: string, pitchId: string) {
  return mutatePitch(ownerId, pitchId, (tx, pitch, venue) =>
    refreshPitch(tx, pitch, venue, false),
  );
}

export function maintainSlots(
  ownerId: string,
  pitchId: string,
  slotIds: string[],
  block: boolean,
) {
  return mutatePitch(ownerId, pitchId, async (tx, pitch, venue) => {
    const slots = await tx.slot.findMany({
      where: { pitchId, id: { in: slotIds }, startAt: { gte: new Date() } },
      select: { id: true, status: true },
    });
    if (slots.length !== slotIds.length)
      throw new AppError(
        404,
        "SLOT_NOT_FOUND",
        "One or more future slots were not found.",
      );
    if (
      slots.some((slot) => slot.status === "HELD" || slot.status === "BOOKED")
    )
      throw protectedConflict();
    if (block)
      await tx.slot.updateMany({
        where: { pitchId, id: { in: slotIds }, status: "AVAILABLE" },
        data: { status: "BLOCKED" },
      });
    else {
      await tx.slot.deleteMany({
        where: { pitchId, id: { in: slotIds }, status: "BLOCKED" },
      });
      await refreshPitch(tx, pitch, venue, false);
    }
    await venueAudit(
      tx,
      ownerId,
      venue.id,
      block ? "SLOTS_BLOCKED" : "SLOTS_UNBLOCKED",
      { pitchId, count: slotIds.length },
    );
    return { count: slotIds.length };
  });
}
