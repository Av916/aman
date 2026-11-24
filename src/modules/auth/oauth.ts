import { getPrisma } from "@/lib/prisma";
import { audit } from "@/modules/users/repository";
import { isDuplicate } from "./repository";

export async function authorizeGoogleAccount(
  providerAccountId: string,
  email: string,
  name?: string | null,
) {
  const prisma = getPrisma();
  const identity = { provider: "google", providerAccountId };
  const findLinked = () =>
    prisma.account.findUnique({
      where: { provider_providerAccountId: identity },
      select: { user: { select: { status: true, emailVerified: true } } },
    });
  const linked = await findLinked();
  if (linked)
    return (
      linked.user.status === "ACTIVE" && Boolean(linked.user.emailVerified)
    );
  if (
    await prisma.user.findUnique({ where: { email }, select: { id: true } })
  ) {
    const concurrent = await findLinked();
    return (
      concurrent?.user.status === "ACTIVE" &&
      Boolean(concurrent.user.emailVerified)
    );
  }

  try {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name:
            name
              ?.replace(/[\p{Cc}\p{Cf}]/gu, "")
              .trim()
              .slice(0, 80) || "PitchMate player",
          email,
          emailVerified: new Date(),
          accounts: { create: { ...identity, type: "oauth" } },
        },
        select: { id: true },
      });
      await audit(tx, user.id, "OAUTH_CUSTOMER_CREATED");
      await audit(tx, user.id, "OAUTH_ACCOUNT_LINKED");
    });
    return true;
  } catch (error) {
    if (!isDuplicate(error)) throw error;
    const concurrent = await findLinked();
    return (
      concurrent?.user.status === "ACTIVE" &&
      Boolean(concurrent.user.emailVerified)
    );
  }
}
