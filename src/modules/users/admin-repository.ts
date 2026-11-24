import { getPrisma } from "@/lib/prisma";

export function listRecentUsers() {
  return getPrisma().user.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 25,
    select: { id: true, name: true, email: true, role: true, status: true },
  });
}

export function listRecentOwners() {
  return getPrisma().ownerProfile.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 25,
    select: {
      id: true,
      businessName: true,
      verificationStatus: true,
      user: { select: { email: true } },
    },
  });
}

export function listRecentAuditEvents() {
  return getPrisma().auditLog.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 25,
    select: { id: true, action: true, entityType: true, createdAt: true },
  });
}

export function accountCounts() {
  const database = getPrisma();
  return Promise.all([
    database.user.count(),
    database.ownerProfile.count(),
    database.ownerProfile.count({ where: { verificationStatus: "PENDING" } }),
  ]);
}
