import { describe, expect, it } from "vitest";
import {
  customerRegistration,
  ownerRegistration,
} from "@/modules/auth/schemas";
import {
  createToken,
  hashPassword,
  tokenDigest,
  verifyPassword,
} from "@/modules/auth/crypto";
import { updateProfileSchema } from "@/modules/users/schemas";

const player = {
  name: "  Anika Rao  ",
  email: "  Anika@Example.com  ",
  password: "bowl-a-wicked-yorker",
};

describe("account validation", () => {
  it("normalizes email and display name", () => {
    expect(customerRegistration.parse(player)).toEqual({
      name: "Anika Rao",
      email: "anika@example.com",
      password: player.password,
    });
  });

  it("rejects weak passwords, elevated roles and invalid business details", () => {
    expect(
      customerRegistration.safeParse({ ...player, password: "short" }).success,
    ).toBe(false);
    expect(
      customerRegistration.safeParse({ ...player, role: "ADMIN" }).success,
    ).toBe(false);
    expect(
      ownerRegistration.safeParse({
        ...player,
        businessName: "Crease",
        businessPhone: "not-a-phone",
      }).success,
    ).toBe(false);
    expect(
      ownerRegistration.safeParse({
        ...player,
        businessName: "Crease",
        businessPhone: "+91 98765 43210",
      }).success,
    ).toBe(true);
  });

  it("permits clearing a phone number and rejects role, status and email edits", () => {
    expect(updateProfileSchema.safeParse({ phone: null }).success).toBe(true);
    for (const field of ["role", "status", "email"]) {
      expect(
        updateProfileSchema.safeParse({ name: "Anika", [field]: "value" })
          .success,
      ).toBe(false);
    }
    expect(updateProfileSchema.safeParse({}).success).toBe(false);
  });
});

describe("credential and token protection", () => {
  it("uses salted Argon2id and verifies correct passwords only", async () => {
    const passwordHash = await hashPassword(player.password);
    expect(passwordHash).toMatch(/^\$argon2id\$/);
    expect(await hashPassword(player.password)).not.toBe(passwordHash);
    expect(await verifyPassword(passwordHash, player.password)).toBe(true);
    expect(await verifyPassword(passwordHash, "wrong")).toBe(false);
    expect(await verifyPassword(null, player.password)).toBe(false);
  });

  it("generates distinct digests and a bounded expiry", () => {
    const token = createToken(30);
    expect(token.raw).toMatch(/^[a-f0-9]{64}$/);
    expect(token.digest).toBe(tokenDigest(token.raw));
    expect(token.digest).not.toBe(token.raw);
    expect(token.digest).not.toBe(createToken(30).digest);
    expect(token.expires.getTime() - Date.now()).toBeGreaterThan(29 * 60_000);
  });
});
