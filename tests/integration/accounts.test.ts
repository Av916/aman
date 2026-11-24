import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getPrisma } from "@/lib/prisma";
import {
  authenticate,
  registerCustomer,
  registerOwner,
  requestPasswordReset,
  resetPassword,
  verifyEmail,
} from "@/modules/auth/service";
import { authorizeGoogleAccount } from "@/modules/auth/oauth";
import { tokenDigest } from "@/modules/auth/crypto";
import { updateProfile } from "@/modules/users/service";
import { limitAttempt } from "@/modules/auth/rate-limit";

const databaseUrl = process.env.TEST_DATABASE_URL;
const password = "a-very-decent-cover-drive";
const nextPassword = "a-beautiful-cut-shot";
const newEmail = () => `integration-${randomUUID()}@example.test`;

describe.skipIf(!databaseUrl)("account transactions against PostgreSQL", () => {
  beforeAll(() => {
    if (!databaseUrl || databaseUrl === process.env.DATABASE_URL)
      throw new Error("Set TEST_DATABASE_URL to a separate migrated database.");
    process.env.DATABASE_URL = databaseUrl;
  });
  afterAll(() => getPrisma().$disconnect());

  it("creates a customer, requires email verification and rejects duplicate emails", async () => {
    const input = { name: "Anika Rao", email: newEmail(), password };
    const { user, email } = await registerCustomer(input);
    expect(user.role).toBe("CUSTOMER");
    const record = await getPrisma().user.findUniqueOrThrow({
      where: { id: user.id },
      include: { verificationTokens: true, auditLogs: true },
    });
    expect(record.emailVerified).toBeNull();
    expect(record.passwordHash).toMatch(/^\$argon2id\$/);
    expect(record.verificationTokens[0].token).toBe(tokenDigest(email.raw));
    expect(record.auditLogs[0].action).toBe("CUSTOMER_REGISTERED");
    expect(await authenticate(input.email, password)).toBeNull();
    await expect(registerCustomer(input)).rejects.toMatchObject({
      status: 409,
    });
    await expect(
      verifyEmail(email.raw, "wrong password"),
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    await verifyEmail(email.raw, password);
    await expect(verifyEmail(email.raw, password)).rejects.toMatchObject({
      code: "INVALID_TOKEN",
    });
    expect(await authenticate(input.email, password)).toMatchObject({
      id: user.id,
    });
  });

  it("creates one pending owner profile atomically even under duplicate submissions", async () => {
    const input = {
      name: "Nisha Ray",
      email: newEmail(),
      password,
      businessName: "Wicket Club",
      businessPhone: "+91 98765 43210",
    };
    const results = await Promise.allSettled([
      registerOwner(input),
      registerOwner(input),
    ]);
    expect(results.map(({ status }) => status).sort()).toEqual([
      "fulfilled",
      "rejected",
    ]);
    const record = await getPrisma().user.findUniqueOrThrow({
      where: { email: input.email },
      include: { ownerProfile: true, auditLogs: true },
    });
    expect(record.role).toBe("OWNER");
    expect(record.ownerProfile).toMatchObject({
      businessName: input.businessName,
      verificationStatus: "PENDING",
    });
    expect(record.auditLogs[0].action).toBe("OWNER_REGISTERED");
  });

  it("returns only safe profile fields and persists clearing a phone number", async () => {
    const { user } = await registerCustomer({
      name: "Anika Rao",
      email: newEmail(),
      password,
    });
    const profile = await updateProfile(user.id, {
      name: "Anika Sen",
      phone: "+91 98765 43210",
    });
    expect(profile).toMatchObject({
      name: "Anika Sen",
      phone: "+91 98765 43210",
    });
    expect(profile).not.toHaveProperty("passwordHash");
    expect(await updateProfile(user.id, { phone: "" })).toMatchObject({
      phone: null,
    });
  });

  it("rejects expired tokens and permits only one concurrent password reset", async () => {
    const email = newEmail();
    const registration = await registerCustomer({
      name: "Anika Rao",
      email,
      password,
    });
    await verifyEmail(registration.email.raw, password);
    const expired = (await requestPasswordReset(email))!;
    await getPrisma().passwordResetToken.update({
      where: { tokenHash: tokenDigest(expired.raw) },
      data: { expiresAt: new Date(0) },
    });
    await expect(
      resetPassword(expired.raw, nextPassword),
    ).rejects.toMatchObject({ code: "INVALID_TOKEN" });

    const first = (await requestPasswordReset(email))!;
    const second = (await requestPasswordReset(email))!;
    const attempts = await Promise.allSettled([
      resetPassword(first.raw, nextPassword),
      resetPassword(second.raw, nextPassword),
    ]);
    expect(attempts.map(({ status }) => status).sort()).toEqual([
      "fulfilled",
      "rejected",
    ]);
    expect(await authenticate(email, password)).toBeNull();
    expect(await authenticate(email, nextPassword)).toMatchObject({
      sessionVersion: 1,
    });
    await expect(resetPassword(first.raw, password)).rejects.toMatchObject({
      code: "INVALID_TOKEN",
    });
    await expect(resetPassword(second.raw, password)).rejects.toMatchObject({
      code: "INVALID_TOKEN",
    });
  });

  it("provisions Google accounts atomically without bridging to an existing email", async () => {
    const googleId = randomUUID();
    const email = newEmail();
    expect(
      await Promise.all([
        authorizeGoogleAccount(googleId, email, "Google player"),
        authorizeGoogleAccount(googleId, email, "Google player"),
      ]),
    ).toEqual([true, true]);
    const account = await getPrisma().account.findUniqueOrThrow({
      where: {
        provider_providerAccountId: {
          provider: "google",
          providerAccountId: googleId,
        },
      },
      include: { user: true },
    });
    expect(account.user).toMatchObject({
      role: "CUSTOMER",
      email,
      passwordHash: null,
    });
    expect(account.user.emailVerified).toBeInstanceOf(Date);
    expect(account.access_token).toBeNull();
    const existing = await registerCustomer({
      name: "Existing player",
      email: newEmail(),
      password,
    });
    expect(
      await authorizeGoogleAccount(randomUUID(), existing.user.email),
    ).toBe(false);
    await getPrisma().user.update({
      where: { id: account.userId },
      data: { status: "SUSPENDED" },
    });
    expect(await authorizeGoogleAccount(googleId, email)).toBe(false);
  });

  it("counts rate-limit attempts atomically under concurrent requests", async () => {
    const scope = randomUUID();
    const results = await Promise.allSettled(
      Array.from({ length: 10 }, () =>
        limitAttempt(scope, new Headers(), "test-user"),
      ),
    );
    expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(
      8,
    );
    const rejected = results.filter((result) => result.status === "rejected");
    expect(rejected).toHaveLength(2);
    for (const result of rejected)
      expect(result.reason).toMatchObject({ status: 429 });
  });
});
