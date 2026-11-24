import type { z } from "zod";
import { getPrisma } from "@/lib/prisma";
import { AppError } from "@/lib/api";
import { audit, profileFields } from "./repository";
import type { updateProfileSchema } from "./schemas";

export function updateProfile(
  id: string,
  { name, phone }: z.output<typeof updateProfileSchema>,
) {
  return getPrisma().$transaction(async (tx) => {
    const updated = await tx.user.updateMany({
      where: { id, status: "ACTIVE" },
      data: { name, phone: phone === "" ? null : phone },
    });
    if (!updated.count)
      throw new AppError(
        403,
        "FORBIDDEN",
        "Your account cannot make this change.",
      );
    await audit(tx, id, "PROFILE_UPDATED");
    return tx.user.findUniqueOrThrow({ where: { id }, select: profileFields });
  });
}
