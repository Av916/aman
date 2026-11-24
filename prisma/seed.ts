import "dotenv/config";
import { provisionAdmin } from "./admin";

if (process.env.NODE_ENV === "production")
  throw new Error("Development seed is disabled in production.");
const databaseUrl = new URL(process.env.DATABASE_URL || "");
if (!["localhost", "127.0.0.1", "[::1]"].includes(databaseUrl.hostname)) {
  throw new Error("Development seed requires a loopback database.");
}
await provisionAdmin(
  process.env.SEED_ADMIN_EMAIL,
  process.env.SEED_ADMIN_PASSWORD,
);
