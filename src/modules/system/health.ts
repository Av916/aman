import { getPrisma } from "@/lib/prisma";
import { validateDeployment } from "@/lib/deployment";
import { log } from "@/lib/log";

function response(ready: boolean) {
  return Response.json(
    { status: ready ? "ok" : "unavailable" },
    { status: ready ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}

export const live = () => response(true);

export async function ready() {
  try {
    validateDeployment();

    // A connected but unmigrated database cannot accept operational traffic.
    await getPrisma().$queryRaw`SELECT 1 FROM "JobLease" LIMIT 1`;
    return response(true);
  } catch {
    log("error", "readiness.failed", { code: "DEPENDENCY_UNAVAILABLE" });
    return response(false);
  }
}
