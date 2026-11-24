import { randomUUID } from "node:crypto";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import type { Venue } from "@/generated/prisma/client";
import { AppError } from "@/lib/api";
import { getPrisma } from "@/lib/prisma";
import { setAmenities } from "@/modules/amenities/service";
import {
  lockPitch,
  lockVenue,
  managedVenue,
  venueAudit,
  venueMissing,
} from "./venue.repository";
import type { venueCreate, venueUpdate } from "./venue.validation";
import { managementInclude } from "./venue.types";
import { venueSettings } from "./settings";
import { refreshPitch } from "@/modules/availability/service";

export const conflict = (message: string, code = "VENUE_CONFLICT") =>
  new AppError(409, code, message);
export function assertEditable(venue: Pick<Venue, "deletedAt" | "status">) {
  if (
    venue.deletedAt ||
    venue.status === "ARCHIVED" ||
    venue.status === "SUSPENDED"
  )
    throw conflict("This venue is currently read-only.");
}

export async function reapproveAfterEdit(
  tx: Prisma.TransactionClient,
  venue: Venue,
) {
  if (venue.status !== "APPROVED" && venue.status !== "PENDING_APPROVAL")
    return;
  await tx.venue.update({
    where: { id: venue.id },
    data: { status: "DRAFT", publishedAt: null, rejectionReason: null },
  });
}

export async function createVenue(
  ownerId: string,
  { amenityIds, ...data }: z.output<typeof venueCreate>,
) {
  const prefix = data.name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  return getPrisma().$transaction(async (tx) => {
    const venue = await tx.venue.create({
      data: {
        ...data,
        timezone: data.timezone ?? venueSettings().DEFAULT_TIMEZONE,
        ownerId,
        slug: `${prefix || "turf"}-${randomUUID().slice(0, 12)}`,
      },
    });
    if (amenityIds) await setAmenities(tx, venue.id, amenityIds);
    await venueAudit(tx, ownerId, venue.id, "VENUE_CREATED");
    return venue;
  });
}

export async function editVenue(
  ownerId: string,
  id: string,
  { amenityIds, ...data }: z.output<typeof venueUpdate>,
) {
  return getPrisma().$transaction(
    async (tx) => {
      const before = await lockVenue(tx, id, ownerId);
      assertEditable(before);
      const changed = Object.entries(data).some(
        ([key, value]) => before[key as keyof Venue] !== value,
      );
      const currentAmenities = amenityIds
        ? await tx.venueAmenity.findMany({
            where: { venueId: id },
            select: { amenityId: true },
          })
        : undefined;
      const changedAmenities =
        amenityIds &&
        (currentAmenities?.length !== amenityIds.length ||
          currentAmenities.some(
            ({ amenityId }) => !amenityIds.includes(amenityId),
          ));
      if (changed || changedAmenities) {
        await tx.venue.update({ where: { id }, data });
        if (changedAmenities) await setAmenities(tx, id, amenityIds);
        await reapproveAfterEdit(tx, before);
        if (data.timezone && data.timezone !== before.timezone) {
          const pitches = await tx.pitch.findMany({
            where: { venueId: id },
            select: { id: true },
            orderBy: { id: "asc" },
          });
          for (const pitch of pitches)
            await refreshPitch(tx, await lockPitch(tx, pitch.id), {
              timezone: data.timezone,
            });
        }
        await venueAudit(tx, ownerId, id, "VENUE_EDITED");
      }
      return tx.venue.findUniqueOrThrow({
        where: { id },
        include: managementInclude,
      });
    },
    { timeout: 30_000 },
  );
}

export async function getOwnerVenue(ownerId: string, id: string) {
  const venue = await managedVenue(id, ownerId);
  if (!venue) throw venueMissing();
  return venue;
}

export async function assertListingReady(
  tx: Prisma.TransactionClient,
  venue: Venue,
) {
  const hasDetails =
    [
      venue.description,
      venue.address,
      venue.city,
      venue.state,
      venue.country,
      venue.postalCode,
      venue.contactEmail,
      venue.contactPhone,
    ].every((value) => value.trim().length > 0) &&
    venue.latitude !== null &&
    venue.longitude !== null;
  if (!hasDetails)
    throw conflict(
      "Complete the venue details, contact fields and map location before submitting.",
      "VENUE_INCOMPLETE",
    );
  const image = await tx.venueImage.count({
    where: { venueId: venue.id, isCover: true },
  });
  const pitches = await tx.pitch.findMany({
    where: { venueId: venue.id, isActive: true },
    select: {
      id: true,
      hours: { where: { isClosed: false }, select: { id: true }, take: 1 },
    },
  });
  if (!image || !pitches.length || pitches.some((pitch) => !pitch.hours.length))
    throw conflict(
      "Add a cover photo and an operating schedule for every active pitch before submitting.",
      "VENUE_INCOMPLETE",
    );
}

export async function ownerAction(
  ownerId: string,
  id: string,
  action: "submit" | "publish" | "archive",
) {
  return getPrisma().$transaction(
    async (tx) => {
      const venue = await lockVenue(tx, id, ownerId);
      if (action === "archive" && venue.status === "ARCHIVED") return venue;
      if (
        action === "publish" &&
        venue.status === "APPROVED" &&
        venue.publishedAt
      )
        return venue;
      if (action === "submit" && venue.status === "PENDING_APPROVAL")
        return venue;
      if (action !== "archive") assertEditable(venue);
      if (
        (action === "submit" &&
          !["DRAFT", "REJECTED"].includes(venue.status)) ||
        (action === "publish" && venue.status !== "APPROVED")
      )
        throw conflict("This venue cannot make that status transition.");
      let data: Prisma.VenueUpdateInput;
      if (action === "archive") {
        const protectedSlot = await tx.slot.findFirst({
          where: {
            pitch: { venueId: id },
            status: { in: ["HELD", "BOOKED"] },
            endAt: { gt: new Date() },
          },
          select: { id: true },
        });
        if (protectedSlot)
          throw conflict(
            "This venue has held or booked slots.",
            "PROTECTED_SLOTS",
          );
        data = { status: "ARCHIVED", deletedAt: new Date(), publishedAt: null };
      } else {
        await assertListingReady(tx, venue);
        data =
          action === "submit"
            ? { status: "PENDING_APPROVAL", rejectionReason: null }
            : { publishedAt: new Date() };
        if (action === "publish") {
          const pitches = await tx.pitch.findMany({
            where: { venueId: id, isActive: true },
            orderBy: { id: "asc" },
          });
          for (const pitch of pitches) {
            await lockPitch(tx, pitch.id);
            await refreshPitch(tx, pitch, venue, false);
          }
        }
      }
      const updated = await tx.venue.update({ where: { id }, data });
      const event = {
        submit: "VENUE_SUBMITTED",
        publish: "VENUE_PUBLISHED",
        archive: "VENUE_ARCHIVED",
      }[action];
      await venueAudit(tx, ownerId, id, event, {
        from: venue.status,
        to: updated.status,
      });
      return updated;
    },
    { timeout: 30_000 },
  );
}
