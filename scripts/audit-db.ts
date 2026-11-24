import "dotenv/config";
import { auditIntegrity } from "@/modules/system/integrity";
import { getPrisma } from "@/lib/prisma";

try {
  const findings = await auditIntegrity();
  console.info(JSON.stringify({ findings }, null, 2));
  if (findings.some((row) => row.count)) process.exitCode = 1;
} finally {
  await getPrisma().$disconnect();
}
