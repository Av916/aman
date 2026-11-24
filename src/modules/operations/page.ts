import { currentUser } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { dashboardPath } from "@/config/navigation";
import {
  rolesWith,
  venueScope,
  type Permission,
} from "@/modules/permissions/operations";

const sections: [string, Permission][] = [
  ["overview", "finance"],
  ["calendar", "calendar"],
  ["reservations", "calendar"],
  ["check-in", "attend"],
  ["customers", "customers"],
  ["reviews", "reviews"],
  ["revenue", "finance"],
  ["payments", "finance"],
  ["refunds", "refund"],
  ["reports", "finance"],
];

export async function workspaceUser(permission: Permission, admin = false) {
  const actor = await currentUser();
  if (!actor) redirect("/login");
  if (admin) {
    if (actor.role !== "ADMIN") redirect(dashboardPath[actor.role]);
    return { actor };
  }
  if (actor.role === "OWNER") return { actor };
  if (actor.role === "ADMIN") redirect("/admin/dashboard");
  const db = getPrisma();
  if (!(await db.venue.count({ where: venueScope(actor, permission) }))) {
    const hasCalendar = await db.venue.count({
      where: venueScope(actor, "calendar"),
    });
    redirect(hasCalendar ? "/owner/calendar" : "/dashboard");
  }
  const assignments = await db.staffMember.findMany({
    where: {
      userId: actor.id,
      status: "ACTIVE",
      assignments: { some: { venue: venueScope(actor, "calendar") } },
    },
    select: { role: true },
  });
  return {
    actor,
    staffSections: sections
      .filter(([, required]) =>
        assignments.some(({ role }) => rolesWith(required).includes(role)),
      )
      .map(([section]) => section),
  };
}
