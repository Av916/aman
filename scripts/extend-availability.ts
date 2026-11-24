import "dotenv/config";
import { extendAvailability } from "@/modules/availability/service";
import { cleanOrphanImages } from "@/modules/media/service";
import { getPrisma } from "@/lib/prisma";

try {
  let cursor: string | undefined;
  let processed = 0;
  let generated = 0;
  do {
    const result = await extendAvailability(cursor);
    cursor = result.nextCursor ?? undefined;
    processed += result.processed;
    generated += result.generated;
  } while (cursor);
  console.info({
    processed,
    generated,
    cleanedImages: await cleanOrphanImages(),
  });
} finally {
  await getPrisma().$disconnect();
}
