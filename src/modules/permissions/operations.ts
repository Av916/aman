import type { Prisma, StaffRole, UserRole } from "@/generated/prisma/client";
import { AppError } from "@/lib/api";

export type Actor = { id: string; role: UserRole; email?: string | null };
export type Permission =
  | "calendar"
  | "reserve"
  | "attend"
  | "cancel"
  | "policies"
  | "collect"
  | "finance"
  | "refund"
  | "staff"
  | "customers"
  | "maintenance"
  | "reviews"
  | "coupons";
const permissions: Record<StaffRole, Permission[]> = {
  MANAGER: [
    "calendar",
    "reserve",
    "attend",
    "cancel",
    "collect",
    "finance",
    "customers",
    "maintenance",
    "reviews",
  ],
  RECEPTIONIST: ["calendar", "reserve", "attend", "collect", "customers"],
  ACCOUNTANT: ["calendar", "finance", "refund"],
  GROUND_STAFF: ["calendar", "attend"],
};

export const rolesWith = (permission: Permission) =>
  Object.keys(permissions).filter((role): role is StaffRole =>
    permissions[role as StaffRole].includes(permission),
  );

export function venueScope(
  actor: Actor,
  permission: Permission,
): Prisma.VenueWhereInput {
  const verifiedOwner = {
    role: "OWNER" as const,
    status: "ACTIVE" as const,
    ownerProfile: { verificationStatus: "APPROVED" as const },
  };
  if (actor.role === "ADMIN") return { deletedAt: null };
  return {
    deletedAt: null,
    owner: verifiedOwner,
    OR: [
      ...(actor.role === "OWNER" ? [{ ownerId: actor.id }] : []),
      {
        staffAssignments: {
          some: {
            staffMember: {
              userId: actor.id,
              status: "ACTIVE",
              role: { in: rolesWith(permission) },
              user: { status: "ACTIVE" },
            },
          },
        },
      },
    ],
  };
}

export async function requireVenueAccess(
  db: Prisma.TransactionClient,
  actor: Actor,
  venueId: string,
  permission: Permission,
) {
  const venue = await db.venue.findFirst({
    where: { id: venueId, AND: [venueScope(actor, permission)] },
  });
  if (!venue)
    throw new AppError(
      404,
      "VENUE_NOT_FOUND",
      "This venue is unavailable to your account.",
    );
  return venue;
}

export async function requireVenueWrite(
  tx: Prisma.TransactionClient,
  actor: Actor,
  venueId: string,
  permission: Permission,
) {
  const venue = await requireVenueAccess(tx, actor, venueId, permission);
  if (
    actor.role === "ADMIN" ||
    (actor.role === "OWNER" && actor.id === venue.ownerId)
  )
    return venue;
  const members = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM "StaffMember" WHERE "ownerId" = ${venue.ownerId}::uuid AND "userId" = ${actor.id}::uuid FOR SHARE
  `;
  if (!members.length)
    throw new AppError(403, "FORBIDDEN", "Your staff access has changed.");
  return requireVenueAccess(tx, actor, venueId, permission);
}
