import { getPrisma } from "../src/lib/prisma";
import { hashPassword } from "../src/modules/auth/crypto";
import { email, password } from "../src/modules/auth/schemas";
import { audit } from "../src/modules/users/repository";

export async function provisionAdmin(rawEmail: unknown, rawPassword: unknown) {
  const adminEmail = email.parse(rawEmail);
  const adminPassword = password.min(16).parse(rawPassword);
  const prisma = getPrisma();

  try {
    const passwordHash = await hashPassword(adminPassword);
    await prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({
        where: { email: adminEmail },
        select: { role: true, status: true },
      });
      if (existing) {
        if (existing.role !== "ADMIN" || existing.status !== "ACTIVE") {
          throw new Error(
            "Choose an email that does not belong to an existing account.",
          );
        }
        console.info("An active administrator already uses this email.");
        return;
      }
      const admin = await tx.user.create({
        data: {
          name: "PitchMate Admin",
          email: adminEmail,
          passwordHash,
          role: "ADMIN",
          emailVerified: new Date(),
        },
      });
      await audit(tx, admin.id, "ADMIN_PROVISIONED");
      console.info("Administrator provisioned.");
    });
  } finally {
    await prisma.$disconnect();
  }
}
