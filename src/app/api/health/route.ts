import { AppError, endpoint, success } from "@/lib/api";
import { getPrisma } from "@/lib/prisma";

export const GET = endpoint(async () => {
  try {
    await getPrisma().$queryRaw`SELECT 1`;
    return success("PitchMate is healthy.", { status: "ok" });
  } catch {
    throw new AppError(
      503,
      "DATABASE_UNAVAILABLE",
      "PitchMate is temporarily unavailable.",
    );
  }
});
