import { getPrisma } from "@/lib/prisma";
import { AppError } from "@/lib/api";
import type { Prisma } from "@/generated/prisma/client";

export function listAmenities() {
  return getPrisma().amenity.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });
}

export async function setAmenities(
  tx: Prisma.TransactionClient,
  venueId: string,
  amenityIds: string[],
) {
  if (
    (await tx.amenity.count({
      where: { id: { in: amenityIds }, isActive: true },
    })) !== amenityIds.length
  )
    throw new AppError(
      422,
      "UNKNOWN_AMENITY",
      "Select amenities from the current catalog.",
    );
  await tx.venueAmenity.deleteMany({ where: { venueId } });
  if (amenityIds.length)
    await tx.venueAmenity.createMany({
      data: amenityIds.map((amenityId) => ({ venueId, amenityId })),
    });
}
