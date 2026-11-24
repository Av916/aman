import { z } from "zod";
import { AddonPricingType } from "@/generated/prisma/enums";
import { AppError } from "@/lib/api";
import { getPrisma } from "@/lib/prisma";
import {
  lockVenue,
  venueAudit,
  venueMissing,
} from "@/modules/venues/venue.repository";
import { assertEditable } from "@/modules/venues/venue.service";
import { publicVenueWhere } from "@/modules/venues/venue.types";
import { paise } from "@/modules/pricing/validation";

export const addonInput = z.strictObject({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(400).optional(),
  price: paise,
  pricingType: z.enum(AddonPricingType),
  isActive: z.boolean().optional(),
});
export const addonPatch = addonInput
  .partial()
  .refine((input) => Object.keys(input).length > 0, "Supply an add-on field.");
const fields = {
  id: true,
  name: true,
  description: true,
  price: true,
  pricingType: true,
  isActive: true,
} as const;

export async function venueAddons(venueId: string, ownerId?: string) {
  const venue = await getPrisma().venue.findFirst({
    where: { id: venueId, ...(ownerId ? { ownerId } : publicVenueWhere) },
    select: {
      addons: {
        where: ownerId ? {} : { isActive: true },
        select: fields,
        orderBy: { name: "asc" },
      },
    },
  });
  if (!venue) throw venueMissing();
  return venue.addons;
}

export function addAddon(
  ownerId: string,
  venueId: string,
  data: z.output<typeof addonInput>,
) {
  return getPrisma().$transaction(async (tx) => {
    assertEditable(await lockVenue(tx, venueId, ownerId));
    if ((await tx.addon.count({ where: { venueId } })) >= 50)
      throw new AppError(
        409,
        "ADDON_LIMIT",
        "This venue has reached its add-on limit.",
      );
    const addon = await tx.addon.create({
      data: { venueId, ...data },
      select: fields,
    });
    await venueAudit(tx, ownerId, venueId, "ADDON_CREATED", {
      addonId: addon.id,
    });
    return addon;
  });
}

export function editAddon(
  ownerId: string,
  id: string,
  data: z.output<typeof addonPatch>,
) {
  return getPrisma().$transaction(async (tx) => {
    const row = await tx.addon.findFirst({
      where: { id, venue: { ownerId } },
      select: { venueId: true },
    });
    if (!row) throw new AppError(404, "ADDON_NOT_FOUND", "Add-on not found.");
    assertEditable(await lockVenue(tx, row.venueId, ownerId));
    const addon = await tx.addon.update({
      where: { id },
      data,
      select: fields,
    });
    await venueAudit(tx, ownerId, row.venueId, "ADDON_UPDATED", {
      addonId: id,
    });
    return addon;
  });
}
