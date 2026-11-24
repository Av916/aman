import { randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { AppError } from "@/lib/api";
import { getPrisma } from "@/lib/prisma";
import { lockVenue, venueAudit } from "@/modules/venues/venue.repository";
import {
  assertEditable,
  conflict,
  reapproveAfterEdit,
} from "@/modules/venues/venue.service";
import { publicImageSelect } from "@/modules/venues/venue.types";
import { venueSettings } from "@/modules/venues/settings";
import { putImage, removeStoredImage, storageKey } from "./storage";
import { optimizeImage } from "./validation";

const cleanupAge = 20 * 60_000;
const imageMissing = () =>
  new AppError(404, "IMAGE_NOT_FOUND", "Image not found.");
const imageLimit = () =>
  conflict("This venue has reached its image limit.", "IMAGE_LIMIT");

export async function uploadImage(
  ownerId: string,
  venueId: string,
  file: File,
  altText: string,
) {
  const database = getPrisma();
  const capacity = venueSettings().MAX_VENUE_IMAGES;
  const id = randomUUID();
  const key = storageKey(id);
  await database.$transaction(async (tx) => {
    const venue = await lockVenue(tx, venueId, ownerId);
    assertEditable(venue);
    if ((await tx.venueImage.count({ where: { venueId } })) >= capacity)
      throw imageLimit();
    await tx.mediaCleanup.create({ data: { storageKey: key } });
  });
  try {
    const imageUrl = await putImage(key, await optimizeImage(file));
    return await database.$transaction(async (tx) => {
      const venue = await lockVenue(tx, venueId, ownerId);
      assertEditable(venue);
      const images = await tx.venueImage.findMany({
        where: { venueId },
        select: { sortOrder: true, isCover: true },
      });
      if (images.length >= capacity) throw imageLimit();
      const image = await tx.venueImage.create({
        data: {
          id,
          venueId,
          storageKey: key,
          imageUrl,
          altText,
          isCover: !images.some((item) => item.isCover),
          sortOrder: Math.max(-1, ...images.map((item) => item.sortOrder)) + 1,
        },
        select: publicImageSelect,
      });
      await tx.mediaCleanup.delete({ where: { storageKey: key } });
      await reapproveAfterEdit(tx, venue);
      await venueAudit(tx, ownerId, venueId, "VENUE_IMAGE_ADDED", {
        imageId: id,
      });
      return image;
    });
  } catch (error) {
    await cleanupKey(key);
    throw error;
  }
}

async function cleanupKey(key: string) {
  const database = getPrisma();
  try {
    // A committed attachment always removes its cleanup row in the same transaction.
    if (
      !(await database.mediaCleanup.findUnique({ where: { storageKey: key } }))
    )
      return true;
    await removeStoredImage(key);
    await database.mediaCleanup.deleteMany({ where: { storageKey: key } });
    return true;
  } catch {
    return false;
  }
}

export async function cleanOrphanImages() {
  const queued = await getPrisma().mediaCleanup.findMany({
    where: { createdAt: { lt: new Date(Date.now() - cleanupAge) } },
    orderBy: { createdAt: "asc" },
    take: 25,
  });
  const results = await Promise.all(
    queued.map(async (item) => {
      const removed = await cleanupKey(item.storageKey);
      if (!removed)
        await getPrisma().mediaCleanup.updateMany({
          where: { storageKey: item.storageKey },
          data: { createdAt: new Date() },
        });
      return removed;
    }),
  );
  return results.filter(Boolean).length;
}

export function reorderImages(
  ownerId: string,
  venueId: string,
  imageIds: string[],
) {
  return getPrisma().$transaction(async (tx) => {
    const venue = await lockVenue(tx, venueId, ownerId);
    assertEditable(venue);
    const images = await tx.venueImage.findMany({
      where: { venueId },
      select: { id: true, sortOrder: true },
    });
    if (
      images.length !== imageIds.length ||
      images.some((image) => !imageIds.includes(image.id))
    )
      throw conflict(
        "Reload the gallery and include every current image.",
        "IMAGE_ORDER_CHANGED",
      );
    for (const [sortOrder, id] of imageIds.entries()) {
      await tx.venueImage.update({ where: { id }, data: { sortOrder } });
    }
    await reapproveAfterEdit(tx, venue);
    await venueAudit(tx, ownerId, venueId, "VENUE_IMAGES_REORDERED");
    return tx.venueImage.findMany({
      where: { venueId },
      select: publicImageSelect,
      orderBy: { sortOrder: "asc" },
    });
  });
}

export function editImage(
  ownerId: string,
  venueId: string,
  id: string,
  data: { altText?: string; isCover?: true },
) {
  return getPrisma().$transaction(async (tx) => {
    const venue = await lockVenue(tx, venueId, ownerId);
    assertEditable(venue);
    const image = await tx.venueImage.findFirst({
      where: { id, venueId },
      select: publicImageSelect,
    });
    if (!image) throw imageMissing();
    if (data.isCover && !image.isCover) {
      await tx.venueImage.updateMany({
        where: { venueId, isCover: true },
        data: { isCover: false },
      });
    }
    await reapproveAfterEdit(tx, venue);
    await venueAudit(tx, ownerId, venueId, "VENUE_IMAGE_EDITED", {
      imageId: id,
    });
    return tx.venueImage.update({
      where: { id },
      data,
      select: publicImageSelect,
    });
  });
}

async function selectFallbackCover(
  tx: Prisma.TransactionClient,
  venueId: string,
) {
  const next = await tx.venueImage.findFirst({
    where: { venueId },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: { id: true },
  });
  if (next)
    await tx.venueImage.update({
      where: { id: next.id },
      data: { isCover: true },
    });
}

export async function deleteImage(
  ownerId: string,
  venueId: string,
  id: string,
) {
  const key = await getPrisma().$transaction(async (tx) => {
    const venue = await lockVenue(tx, venueId, ownerId);
    assertEditable(venue);
    const image = await tx.venueImage.findFirst({ where: { id, venueId } });
    if (!image) throw imageMissing();
    await tx.venueImage.delete({ where: { id } });
    if (image.isCover) await selectFallbackCover(tx, venueId);
    await tx.mediaCleanup.upsert({
      where: { storageKey: image.storageKey },
      create: { storageKey: image.storageKey },
      update: {},
    });
    await reapproveAfterEdit(tx, venue);
    await venueAudit(tx, ownerId, venueId, "VENUE_IMAGE_REMOVED", {
      imageId: id,
    });
    return image.storageKey;
  });
  await cleanupKey(key);
}
