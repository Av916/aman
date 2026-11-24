import { getPrisma } from "@/lib/prisma";
import { AppError } from "@/lib/api";
import { bookingSettings } from "@/modules/bookings/settings";
import { transaction } from "@/modules/bookings/booking.repository";
import type { Actor } from "@/modules/permissions/operations";

function requireAdmin(actor: Actor) {
  if (actor.role !== "ADMIN")
    throw new AppError(403, "FORBIDDEN", "Administrator access is required.");
}

export async function platformMetrics(actor: Actor) {
  requireAdmin(actor);
  const db = getPrisma();
  const [customers, owners, active, pending, booked, cancelled, ledger] =
    await Promise.all([
      db.user.count({ where: { role: "CUSTOMER" } }),
      db.user.count({ where: { role: "OWNER" } }),
      db.venue.count({ where: { status: "APPROVED", deletedAt: null } }),
      db.venue.count({
        where: { status: "PENDING_APPROVAL", deletedAt: null },
      }),
      db.booking.aggregate({
        where: { confirmedAt: { not: null }, status: { not: "RESCHEDULED" } },
        _count: true,
        _sum: { totalAmount: true },
      }),
      db.booking.count({
        where: { status: "CANCELLED", confirmedAt: { not: null } },
      }),
      db.financialTransaction.groupBy({
        by: ["transactionType"],
        where: { currency: "INR" },
        _sum: { amount: true },
      }),
    ]);
  const amount = (kind: (typeof ledger)[number]["transactionType"]) =>
    ledger.find((line) => line.transactionType === kind)?._sum.amount ?? 0;
  return {
    customers,
    owners,
    active,
    pending,
    confirmed: booked._count,
    gross: booked._sum.totalAmount ?? 0,
    captured: amount("PAYMENT_CAPTURE"),
    offline: amount("OFFLINE_PAYMENT"),
    platformFee: amount("PLATFORM_FEE"),
    refunds: amount("REFUND"),
    cancellationRate: booked._count ? (cancelled * 100) / booked._count : 0,
  };
}

export async function feeSetting() {
  const row = await getPrisma().platformSetting.findUnique({
    where: { key: "platformFeePaise" },
  });
  return row?.amount ?? bookingSettings().PLATFORM_FEE_PAISE;
}

export function changeFee(actor: Actor, amount: number, reason: string) {
  requireAdmin(actor);
  return transaction(async (tx) => {
    const entry = await tx.platformSetting.upsert({
      where: { key: "platformFeePaise" },
      create: { key: "platformFeePaise", amount },
      update: { amount },
    });
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: "PLATFORM_FEE_UPDATED",
        entityType: "PlatformSetting",
        entityId: entry.key,
        metadata: { amount, reason },
      },
    });
    return entry;
  });
}

export function changeAccountStatus(
  actor: Actor,
  id: string,
  status: "ACTIVE" | "SUSPENDED",
  reason: string,
) {
  requireAdmin(actor);
  return transaction(async (tx) => {
    const target = await tx.user.findFirst({
      where: { id, role: { not: "ADMIN" } },
      select: { status: true, role: true },
    });
    if (!target)
      throw new AppError(
        404,
        "ACCOUNT_NOT_FOUND",
        "This account cannot be managed here.",
      );
    const account = await tx.user.update({
      where: { id },
      data: { status, sessionVersion: { increment: 1 } },
      select: { id: true, name: true, status: true },
    });
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: "ACCOUNT_STATUS_CHANGED",
        entityType: "User",
        entityId: id,
        metadata: { from: target.status, status, reason },
      },
    });
    return account;
  });
}

export function reviewOwner(
  actor: Actor,
  id: string,
  status: "APPROVED" | "REJECTED",
  reason: string,
) {
  requireAdmin(actor);
  return transaction(async (tx) => {
    const profile = await tx.ownerProfile.update({
      where: { id },
      data: { verificationStatus: status },
    });
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: "OWNER_VERIFICATION_CHANGED",
        entityType: "OwnerProfile",
        entityId: id,
        metadata: { status, reason },
      },
    });
    return profile;
  });
}
