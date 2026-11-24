import "dotenv/config";
import { provisionAdmin } from "./admin";
import { seedDemo } from "./demo";

if (process.env.NODE_ENV === "production")
  throw new Error("Development seed is disabled in production.");
const databaseUrl = new URL(process.env.DATABASE_URL || "");
if (!["localhost", "127.0.0.1", "[::1]"].includes(databaseUrl.hostname)) {
  throw new Error("Development seed requires a loopback database.");
}
if (process.argv.includes("--demo")) {
  await seedDemo(process.env.DEMO_ACCOUNT_PASSWORD);
} else {
  await provisionAdmin(
    process.env.SEED_ADMIN_EMAIL,
    process.env.SEED_ADMIN_PASSWORD,
  );
}
