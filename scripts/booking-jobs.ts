import "dotenv/config";
import { getPrisma } from "@/lib/prisma";
import { runJob, isJobName } from "@/modules/system/jobs";

try {
  const names = process.argv.slice(2);
  for (const name of names.length
    ? names
    : ["expire", "reconcile", "reminders", "outbox"]) {
    if (!isJobName(name)) throw new Error("Unknown job name.");
    console.info(JSON.stringify({ job: name, ...(await runJob(name)) }));
  }
} finally {
  await getPrisma().$disconnect();
}
