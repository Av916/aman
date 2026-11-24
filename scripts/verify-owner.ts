import "dotenv/config";
import { getPrisma } from "@/lib/prisma";
import { email } from "@/modules/auth/schemas";

const address = email.parse(process.argv[2]);
const database = getPrisma();
try {
  await database.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { email: address },
      select: {
        id: true,
        role: true,
        status: true,
        emailVerified: true,
        ownerProfile: { select: { verificationStatus: true } },
      },
    });
    if (
      user?.role !== "OWNER" ||
      user.status !== "ACTIVE" ||
      !user.emailVerified ||
      !user.ownerProfile
    )
      throw new Error(
        "Select an active owner with a verified email and an owner profile.",
      );
    const changed = await tx.ownerProfile.updateMany({
      where: { userId: user.id, verificationStatus: { not: "APPROVED" } },
      data: { verificationStatus: "APPROVED" },
    });
    if (changed.count)
      await tx.auditLog.create({
        data: {
          action: "OWNER_APPROVED_BY_OPERATOR",
          entityType: "User",
          entityId: user.id,
          metadata: { source: "operator-cli" },
        },
      });
  });
  console.info("The owner profile is approved.");
} finally {
  await database.$disconnect();
}
