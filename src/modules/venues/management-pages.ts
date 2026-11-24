import { notFound } from "next/navigation";
import { requireDashboardRole } from "@/lib/auth";
import { findProfile } from "@/modules/users/repository";
import { idSchema } from "./venue.validation";
import { managedVenue } from "./venue.repository";

export async function ownerPageUser() {
  const user = await requireDashboardRole("OWNER");
  return {
    user,
    approved:
      (await findProfile(user.id))?.ownerProfile?.verificationStatus ===
      "APPROVED",
  };
}

export async function ownerPageVenue(rawId: string, ownerId: string) {
  const id = idSchema.safeParse(rawId);
  if (!id.success) notFound();
  const venue = await managedVenue(id.data, ownerId);
  if (!venue) notFound();
  return venue;
}
