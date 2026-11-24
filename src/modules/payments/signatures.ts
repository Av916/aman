import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export function verifySignature(
  body: string | Uint8Array,
  supplied: string | null,
  secret: string,
) {
  if (!supplied || !/^[0-9a-f]{64}$/i.test(supplied)) return false;
  const actual = createHmac("sha256", secret).update(body).digest();
  return timingSafeEqual(actual, Buffer.from(supplied, "hex"));
}
export function validJobToken(
  value: string | null,
  secret: string | undefined,
) {
  const hash = (data: string) => createHash("sha256").update(data).digest();
  return (
    !!secret && timingSafeEqual(hash(value ?? ""), hash(`Bearer ${secret}`))
  );
}
