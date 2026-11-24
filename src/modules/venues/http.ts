import { z } from "zod";
import { requireApprovedOwner, requireUser, assertRole } from "@/lib/auth";
import { endpoint, success, assertSameOrigin } from "@/lib/api";
import { limitAttempt } from "@/modules/auth/rate-limit";
import { idSchema } from "./venue.validation";

type Params<P> = { params: Promise<P> };
type Reply = Promise<Response>;
export const json = success;
export const query = <T extends z.ZodType>(request: Request, schema: T) =>
  schema.parse(Object.fromEntries(new URL(request.url).searchParams));

export function throttleDiscovery(headers: Headers) {
  return limitAttempt("venue-discovery", headers, undefined, {
    global: 15_000,
    ip: 240,
    identity: 240,
  });
}

export function ownerRoute<P extends Record<string, string>>(
  action: (r: Request, ownerId: string, params: P) => Reply,
) {
  return endpoint(async (r: Request, context: Params<P>) => {
    const owner = await requireApprovedOwner();
    if (r.method !== "GET") {
      assertSameOrigin(r);
      await limitAttempt("owner-venue-write", r.headers, owner.id, {
        global: 5000,
        ip: 180,
        identity: 120,
      });
    }
    const params = (await context?.params) ?? ({} as P);
    for (const value of Object.values(params)) idSchema.parse(value);
    return action(r, owner.id, params);
  });
}

export function roleRoute<P extends Record<string, string>>(
  role: "ADMIN" | "CUSTOMER",
  action: (r: Request, userId: string, params: P) => Reply,
) {
  return endpoint(async (r: Request, context: Params<P>) => {
    const user = await requireUser();
    assertRole(user, role);
    if (r.method !== "GET") assertSameOrigin(r);
    await limitAttempt(
      `venue-${role.toLowerCase()}-${r.method.toLowerCase()}`,
      r.headers,
      user.id,
      { global: 6000, ip: 240, identity: 150 },
    );
    const params = (await context?.params) ?? ({} as P);
    for (const value of Object.values(params)) idSchema.parse(value);
    return action(r, user.id, params);
  });
}
