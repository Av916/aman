import { getPrisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

export const profileFields = {
  id: true,
  name: true,
  email: true,
  phone: true,
  image: true,
  role: true,
  status: true,
  emailVerified: true,
  createdAt: true,
  updatedAt: true,
  ownerProfile: {
    select: {
      businessName: true,
      businessPhone: true,
      verificationStatus: true,
    },
  },
} satisfies Prisma.UserSelect;

export type Profile = Prisma.UserGetPayload<{ select: typeof profileFields }>;

export function findProfile(id: string) {
  return getPrisma().user.findUnique({ where: { id }, select: profileFields });
}

export function findAuthUser(email: string) {
  return getPrisma().user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      status: true,
      passwordHash: true,
      emailVerified: true,
      sessionVersion: true,
    },
  });
}

export function findSessionUser(id: string) {
  return getPrisma().user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
      status: true,
      emailVerified: true,
      sessionVersion: true,
    },
  });
}

export function audit(
  database: Pick<Prisma.TransactionClient, "auditLog">,
  userId: string,
  action: string,
) {
  return database.auditLog.create({
    data: { actorId: userId, entityType: "User", entityId: userId, action },
  });
}
