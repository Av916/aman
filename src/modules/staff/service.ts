import { randomBytes } from "node:crypto";
import { z } from "zod";
import { StaffRole } from "@/generated/prisma/enums";
import { AppError } from "@/lib/api";
import { getPrisma } from "@/lib/prisma";
import { getEnv } from "@/lib/env";
import { transaction } from "@/modules/bookings/booking.repository";
import { tokenHash } from "@/modules/operations/bookings";
import {
  requireVenueAccess,
  type Actor,
} from "@/modules/permissions/operations";
import { queueOperationalEmail } from "@/modules/notifications/service";

export const assignedVenues = z
  .array(z.uuid())
  .min(1)
  .max(30)
  .refine((ids) => ids.length === new Set(ids).size);
export const invitationInput = z.strictObject({
  email: z.email().max(254).toLowerCase(),
  role: z.enum(StaffRole),
  venueIds: assignedVenues,
});
export const staffUpdate = z.strictObject({
  role: z.enum(StaffRole).optional(),
  status: z.enum(["ACTIVE", "SUSPENDED", "REMOVED"]).optional(),
});
function ownerOnly(actor: Actor) {
  if (actor.role !== "OWNER")
    throw new AppError(
      403,
      "FORBIDDEN",
      "Only verified owners can manage staff.",
    );
}

export async function staffList(actor: Actor) {
  ownerOnly(actor);
  const db = getPrisma();
  const owner = await db.ownerProfile.findFirst({
    where: { userId: actor.id, verificationStatus: "APPROVED" },
  });
  if (!owner)
    throw new AppError(
      403,
      "OWNER_APPROVAL_REQUIRED",
      "Owner approval is required.",
    );
  const [staff, invitations] = await Promise.all([
    db.staffMember.findMany({
      where: { ownerId: actor.id },
      include: {
        user: { select: { name: true, email: true } },
        assignments: { include: { venue: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    db.staffInvitation.findMany({
      where: { ownerId: actor.id },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        email: true,
        role: true,
        expiresAt: true,
        acceptedAt: true,
      },
    }),
  ]);
  return { staff, invitations };
}

export function inviteStaff(
  actor: Actor,
  input: z.output<typeof invitationInput>,
) {
  ownerOnly(actor);
  return transaction(async (tx) => {
    for (const id of input.venueIds)
      await requireVenueAccess(tx, actor, id, "staff");
    if (input.email === actor.email)
      throw new AppError(422, "SELF_INVITATION", "Choose a different account.");
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + 2 * 86400_000);
    const row = await tx.staffInvitation.create({
      data: {
        ownerId: actor.id,
        email: input.email,
        role: input.role,
        tokenHash: tokenHash(token),
        venueIds: input.venueIds,
        expiresAt,
      },
      select: { id: true, email: true, role: true, expiresAt: true },
    });
    const url = new URL("/staff/invitation", getEnv().APP_URL);
    // The fragment stays in the browser until the user submits the acceptance form.
    url.hash = token;
    await queueOperationalEmail(
      tx,
      row.id,
      `staff-invite:${row.id}`,
      input.email,
      "Staff invitation",
      `Sign in with your invited email, then open ${url.href}`,
    );
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: "STAFF_INVITED",
        entityType: "StaffInvitation",
        entityId: row.id,
      },
    });
    return row;
  });
}

export function acceptStaff(actor: Actor, token: string) {
  return transaction(async (tx) => {
    const now = new Date();
    const where = {
      tokenHash: tokenHash(token),
      acceptedAt: null,
      expiresAt: { gt: now },
    };
    const invite = await tx.staffInvitation.findFirst({ where });
    if (
      !invite ||
      invite.email !== actor.email?.toLowerCase() ||
      actor.role === "ADMIN"
    )
      throw new AppError(
        404,
        "INVITATION_NOT_FOUND",
        "Use the verified account that received this unexpired invitation.",
      );
    const existing = await tx.staffMember.findUnique({
      where: { ownerId_userId: { ownerId: invite.ownerId, userId: actor.id } },
    });
    if (existing)
      throw new AppError(
        409,
        "STAFF_MEMBERSHIP_EXISTS",
        "Ask the owner to update your existing staff membership.",
      );
    for (const id of invite.venueIds)
      await requireVenueAccess(
        tx,
        { id: invite.ownerId, role: "OWNER" },
        id,
        "staff",
      );
    const accepted = await tx.staffInvitation.updateMany({
      where,
      data: { acceptedAt: now },
    });
    if (accepted.count !== 1)
      throw new AppError(
        409,
        "INVITATION_USED",
        "This invitation was already used.",
      );
    const joined = await tx.staffMember.create({
      data: {
        ownerId: invite.ownerId,
        userId: actor.id,
        invitedById: invite.ownerId,
        role: invite.role,
        assignments: {
          create: invite.venueIds.map((venueId) => ({ venueId })),
        },
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: "STAFF_INVITATION_ACCEPTED",
        entityType: "StaffMember",
        entityId: joined.id,
      },
    });
    return joined;
  });
}

export function updateStaff(
  actor: Actor,
  id: string,
  input: z.output<typeof staffUpdate>,
  venueIds?: string[],
) {
  ownerOnly(actor);
  return transaction(async (tx) => {
    const owner = await tx.ownerProfile.findFirst({
      where: { userId: actor.id, verificationStatus: "APPROVED" },
    });
    if (!owner)
      throw new AppError(
        403,
        "OWNER_APPROVAL_REQUIRED",
        "Owner approval is required.",
      );
    const [row] = await tx.$queryRaw<
      { id: string }[]
    >`SELECT id FROM "StaffMember" WHERE id = ${id}::uuid AND "ownerId" = ${actor.id}::uuid FOR UPDATE`;
    if (!row)
      throw new AppError(404, "STAFF_NOT_FOUND", "Staff member not found.");
    if (venueIds) {
      for (const venueId of venueIds)
        await requireVenueAccess(tx, actor, venueId, "staff");
      await tx.staffVenueAssignment.deleteMany({
        where: { staffMemberId: id },
      });
      await tx.staffVenueAssignment.createMany({
        data: venueIds.map((venueId) => ({ venueId, staffMemberId: id })),
      });
    }
    const updated = await tx.staffMember.update({ where: { id }, data: input });
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: "STAFF_ACCESS_UPDATED",
        entityType: "StaffMember",
        entityId: id,
        metadata: { ...input, venueIds: venueIds ?? [] },
      },
    });
    return updated;
  });
}
