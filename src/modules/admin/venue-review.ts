import { getPrisma } from "@/lib/prisma";
import { Prisma, type VenueStatus } from "@/generated/prisma/client";
import {
  lockVenue,
  venueAudit,
  venueMissing,
} from "@/modules/venues/venue.repository";
import { assertListingReady, conflict } from "@/modules/venues/venue.service";
import { managementInclude } from "@/modules/venues/venue.types";

export async function venueReview(id: string) {
  const database = getPrisma();
  const venue = await database.venue.findUnique({
    where: { id },
    include: {
      ...managementInclude,
      owner: {
        select: {
          id: true,
          name: true,
          email: true,
          status: true,
          ownerProfile: {
            select: { businessName: true, verificationStatus: true },
          },
        },
      },
    },
  });
  if (!venue) throw venueMissing();
  const audit = await database.auditLog.findMany({
    where: { entityType: "Venue", entityId: id },
    take: 50,
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    select: {
      id: true,
      actor: { select: { name: true } },
      action: true,
      metadata: true,
      createdAt: true,
    },
  });
  return { venue, audit };
}

const transitions = {
  approve: {
    from: "PENDING_APPROVAL",
    to: "APPROVED",
    action: "VENUE_APPROVED",
  },
  reject: {
    from: "PENDING_APPROVAL",
    to: "REJECTED",
    action: "VENUE_REJECTED",
  },
  suspend: { from: "APPROVED", to: "SUSPENDED", action: "VENUE_SUSPENDED" },
  restore: { from: "SUSPENDED", to: "APPROVED", action: "VENUE_RESTORED" },
} satisfies Record<
  string,
  { from: VenueStatus; to: VenueStatus; action: string }
>;

export async function moderateVenue(
  adminId: string,
  id: string,
  operation: keyof typeof transitions,
  reason?: string,
) {
  return getPrisma().$transaction(async (tx) => {
    const venue = await lockVenue(tx, id);
    const transition = transitions[operation];
    if (venue.deletedAt || venue.status !== transition.from)
      throw conflict(
        "This venue cannot make that status transition.",
        "INVALID_VENUE_TRANSITION",
      );
    if (operation === "reject" && !reason)
      throw conflict("Provide a rejection reason.", "REASON_REQUIRED");
    if (transition.to === "APPROVED") {
      const owner = await tx.user.findUnique({
        where: { id: venue.ownerId },
        select: {
          role: true,
          status: true,
          ownerProfile: { select: { verificationStatus: true } },
        },
      });
      if (
        owner?.role !== "OWNER" ||
        owner.status !== "ACTIVE" ||
        owner.ownerProfile?.verificationStatus !== "APPROVED"
      )
        throw conflict(
          "This owner must be active and verified.",
          "OWNER_APPROVAL_REQUIRED",
        );
      await assertListingReady(tx, venue);
    }
    const data = {
      status: transition.to,
      publishedAt: null,
      rejectionReason: operation === "reject" ? reason : null,
    } satisfies Prisma.VenueUpdateInput;
    const updated = await tx.venue.update({ where: { id }, data });
    await venueAudit(tx, adminId, id, transition.action, {
      from: venue.status,
      to: updated.status,
      ...(reason ? { reason } : {}),
    });
    return updated;
  });
}
