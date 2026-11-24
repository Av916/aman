import type { z } from "zod";
import { AppError } from "@/lib/api";
import { getPrisma } from "@/lib/prisma";
import { audit, findAuthUser } from "@/modules/users/repository";
import {
  createToken,
  hashPassword,
  tokenDigest,
  verifyPassword,
} from "./crypto";
import type { AccountEmail } from "./email";
import {
  consumeVerification,
  createCredentialUser,
  findReset,
  findVerification,
  isDuplicate,
  issueReset,
  issueVerification,
  replacePassword,
  StaleToken,
} from "./repository";
import type {
  changePasswordSchema,
  customerRegistration,
  ownerRegistration,
} from "./schemas";

const invalidToken = () =>
  new AppError(
    400,
    "INVALID_TOKEN",
    "This link is invalid, expired, or already used.",
  );

async function register(
  data: z.output<typeof customerRegistration>,
  business?: { businessName: string; businessPhone: string },
) {
  const token = createToken(24 * 60);
  const passwordHash = await hashPassword(data.password);
  try {
    const user = await createCredentialUser(
      { name: data.name, email: data.email, passwordHash },
      business ? "OWNER" : "CUSTOMER",
      token,
      business,
    );
    return {
      user,
      email: {
        email: user.email,
        raw: token.raw,
        kind: "verify",
      } satisfies AccountEmail,
    };
  } catch (error) {
    if (isDuplicate(error))
      throw new AppError(
        409,
        "EMAIL_IN_USE",
        "An account already uses this email. Sign in or recover your password.",
      );
    throw error;
  }
}

export function registerCustomer(data: z.output<typeof customerRegistration>) {
  return register(data);
}

export function registerOwner({
  businessName,
  businessPhone,
  ...data
}: z.output<typeof ownerRegistration>) {
  return register(data, { businessName, businessPhone });
}

export async function authenticate(email: string, password: string) {
  const user = await findAuthUser(email);
  const valid = await verifyPassword(user?.passwordHash, password);
  if (!user || !valid || user.status !== "ACTIVE" || !user.emailVerified)
    return null;
  await audit(getPrisma(), user.id, "CREDENTIALS_AUTHENTICATED");
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
    sessionVersion: user.sessionVersion,
  };
}

export async function requestPasswordReset(
  email: string,
): Promise<AccountEmail | undefined> {
  const user = await findAuthUser(email);
  if (!user?.passwordHash || user.status !== "ACTIVE") return;
  const token = createToken(30);
  if (!(await issueReset(user, token))) return;
  return { email: user.email, raw: token.raw, kind: "reset" };
}

export async function resendVerification(
  email: string,
  password: string,
): Promise<AccountEmail | undefined> {
  const user = await findAuthUser(email);
  const valid = await verifyPassword(user?.passwordHash, password);
  if (!user || !valid || user.emailVerified || user.status !== "ACTIVE") return;
  const token = createToken(24 * 60);
  await issueVerification(user.email, token);
  return { email: user.email, raw: token.raw, kind: "verify" };
}

export async function verifyEmail(raw: string, password: string) {
  const digest = tokenDigest(raw);
  const record = await findVerification(digest);
  const validPassword = await verifyPassword(
    record?.user.passwordHash,
    password,
  );
  if (
    !record ||
    record.expires <= new Date() ||
    record.user.status !== "ACTIVE"
  )
    throw invalidToken();
  if (!validPassword)
    throw new AppError(
      400,
      "INVALID_CREDENTIALS",
      "The password does not match this account.",
    );
  try {
    if (!(await consumeVerification(record.user, digest))) throw invalidToken();
  } catch (error) {
    if (error instanceof StaleToken) throw invalidToken();
    throw error;
  }
}

export async function resetPassword(raw: string, password: string) {
  const record = await findReset(tokenDigest(raw));
  if (
    !record ||
    record.expiresAt <= new Date() ||
    record.usedAt ||
    record.user.status !== "ACTIVE"
  )
    throw invalidToken();

  try {
    const changed = await replacePassword(
      record.userId,
      record.user.sessionVersion,
      await hashPassword(password),
      record.id,
    );
    if (!changed) throw invalidToken();
  } catch (error) {
    if (error instanceof StaleToken) throw invalidToken();
    throw error;
  }
}

export async function changePassword(
  user: { id: string; email: string },
  data: z.output<typeof changePasswordSchema>,
) {
  const account = await findAuthUser(user.email);
  if (!account || account.id !== user.id || account.status !== "ACTIVE") {
    throw new AppError(
      403,
      "FORBIDDEN",
      "Your account cannot make this change.",
    );
  }
  if (!account.passwordHash) {
    throw new AppError(
      409,
      "OAUTH_ACCOUNT",
      "This account signs in with Google. Manage your password with Google.",
    );
  }
  if (!(await verifyPassword(account.passwordHash, data.currentPassword))) {
    throw new AppError(
      400,
      "INVALID_CREDENTIALS",
      "The current password is incorrect.",
    );
  }
  const changed = await replacePassword(
    account.id,
    account.sessionVersion,
    await hashPassword(data.password),
  );
  if (!changed)
    throw new AppError(
      409,
      "ACCOUNT_CHANGED",
      "Your account changed. Sign in again and retry.",
    );
}
