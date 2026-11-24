import "dotenv/config";
import { provisionAdmin } from "./admin";

if (
  process.env.NODE_ENV !== "production" ||
  !process.argv.includes("--confirm")
) {
  throw new Error(
    "Run production provisioning with NODE_ENV=production and --confirm.",
  );
}
await provisionAdmin(
  process.env.PROVISION_ADMIN_EMAIL,
  process.env.PROVISION_ADMIN_PASSWORD,
);
