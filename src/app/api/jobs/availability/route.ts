import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { AppError, endpoint, success } from "@/lib/api";
import { extendAvailability } from "@/modules/availability/service";
import { cleanOrphanImages } from "@/modules/media/service";
import { venueSettings } from "@/modules/venues/settings";
import { query } from "@/modules/venues/http";

const hash = (value: string) => createHash("sha256").update(value).digest();
const jobQuery = z.object({ cursor: z.uuid().optional() });
export const POST = endpoint(async (r) => {
  const secret = venueSettings().SLOT_JOB_SECRET;
  if (
    !secret ||
    !timingSafeEqual(
      hash(r.headers.get("authorization") ?? ""),
      hash(`Bearer ${secret}`),
    )
  )
    throw new AppError(401, "UNAUTHENTICATED", "Invalid job credentials.");
  const { cursor } = query(r, jobQuery);
  const result = await extendAvailability(cursor);
  return success("Availability extended.", {
    ...result,
    ...(cursor ? {} : { cleanedImages: await cleanOrphanImages() }),
  });
});
