import { createHash, randomBytes } from "node:crypto";
import { hash, verify } from "@node-rs/argon2";

const options = { memoryCost: 19456, timeCost: 2, parallelism: 1 };
let dummyHash: Promise<string> | undefined;

export function hashPassword(password: string) {
  return hash(password, options);
}

export async function verifyPassword(
  hash: string | null | undefined,
  password: string,
) {
  const candidate =
    hash ??
    (await (dummyHash ??= hashPassword(randomBytes(32).toString("hex"))));
  const valid = await verify(candidate, password);
  return Boolean(hash && valid);
}

export function tokenDigest(raw: string) {
  return createHash("sha256").update(raw).digest("hex");
}

export function createToken(minutes: number) {
  const raw = randomBytes(32).toString("hex");
  return {
    raw,
    digest: tokenDigest(raw),
    expires: new Date(Date.now() + minutes * 60_000),
  };
}
