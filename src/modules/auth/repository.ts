import { getPrisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import type { UserRole } from "@/generated/prisma/enums";
import { audit } from "@/modules/users/repository";

type NewUser = { name: string; email: string; passwordHash: string };
type Business = { businessName: string; businessPhone: string };
type IssuedToken = { digest: string; expires: Date };

export function isDuplicate(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

export function createCredentialUser(
  user: NewUser,
  role: UserRole,
  token: IssuedToken,
  business?: Business,
) {
  return getPrisma().$transaction(async (tx) => {
    const record = await tx.user.create({
      data: {
        ...user,
        role,
        ownerProfile: business ? { create: business } : undefined,
        verificationTokens: {
          create: { token: token.digest, expires: token.expires },
        },
      },
      select: { id: true, email: true, role: true },
    });
    await audit(
      tx,
      record.id,
      business ? "OWNER_REGISTERED" : "CUSTOMER_REGISTERED",
    );
    return record;
  });
}

export function issueVerification(email: string, token: IssuedToken) {
  return getPrisma().verificationToken.create({
    data: { identifier: email, token: token.digest, expires: token.expires },
  });
}

export function findVerification(digest: string) {
  return getPrisma().verificationToken.findUnique({
    where: { token: digest },
    select: {
      expires: true,
      user: {
        select: {
          id: true,
          email: true,
          emailVerified: true,
          passwordHash: true,
          status: true,
          sessionVersion: true,
        },
      },
    },
  });
}

export async function consumeVerification(
  user: { id: string; email: string; sessionVersion: number },
  digest: string,
) {
  return getPrisma().$transaction(async (tx) => {
    const updated = await tx.user.updateMany({
      where: {
        id: user.id,
        status: "ACTIVE",
        emailVerified: null,
        sessionVersion: user.sessionVersion,
      },
      data: { emailVerified: new Date() },
    });
    if (updated.count !== 1) return false;
    const claimed = await tx.verificationToken.deleteMany({
      where: {
        token: digest,
        identifier: user.email,
        expires: { gt: new Date() },
      },
    });
    if (!claimed.count) throw new StaleToken();
    await tx.verificationToken.deleteMany({
      where: { identifier: user.email },
    });
    await audit(tx, user.id, "EMAIL_VERIFIED");
    return true;
  });
}

export function issueReset(
  user: { id: string; sessionVersion: number },
  token: IssuedToken,
) {
  return getPrisma().$transaction(async (tx) => {
    const [eligible] = await tx.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "User"
      WHERE "id" = ${user.id}::uuid
        AND "sessionVersion" = ${user.sessionVersion}::integer
        AND "status" = 'ACTIVE'
      FOR UPDATE
    `;
    if (!eligible) return false;
    await tx.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: token.digest,
        expiresAt: token.expires,
      },
    });
    await audit(tx, user.id, "PASSWORD_RESET_REQUESTED");
    return true;
  });
}

export function findReset(digest: string) {
  return getPrisma().passwordResetToken.findUnique({
    where: { tokenHash: digest },
    include: {
      user: { select: { id: true, status: true, sessionVersion: true } },
    },
  });
}

export class StaleToken extends Error {}

export async function replacePassword(
  userId: string,
  version: number,
  passwordHash: string,
  resetId?: string,
) {
  return getPrisma().$transaction(async (tx) => {
    const updated = await tx.user.updateMany({
      where: { id: userId, status: "ACTIVE", sessionVersion: version },
      data: { passwordHash, sessionVersion: { increment: 1 } },
    });
    if (updated.count !== 1) return false;
    const now = new Date();
    if (resetId) {
      const claimed = await tx.passwordResetToken.updateMany({
        where: { id: resetId, userId, usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      });
      if (!claimed.count) throw new StaleToken();
    }
    await tx.passwordResetToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: now },
    });
    await audit(tx, userId, resetId ? "PASSWORD_RESET" : "PASSWORD_CHANGED");
    return true;
  });
}
