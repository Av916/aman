import { setTimeout as delay } from "node:timers/promises";

const origin = new URL(process.env.SMOKE_URL ?? "");
const headers = process.env.VERCEL_AUTOMATION_BYPASS_SECRET
  ? {
      "x-vercel-protection-bypass": process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
    }
  : undefined;

for (const path of [
  "/api/health/live",
  "/api/health/ready",
  "/",
  "/robots.txt",
  "/manifest.webmanifest",
]) {
  let passed = false;
  for (let attempt = 0; attempt < 8; attempt++) {
    const response = await fetch(new URL(path, origin), {
      headers,
      redirect: "error",
      signal: AbortSignal.timeout(8000),
    }).catch(() => null);
    if (response?.ok) {
      if (
        path.startsWith("/api/health/") &&
        (await response.json()).status !== "ok"
      )
        continue;
      passed = true;
      break;
    }
    await delay(2000);
  }
  if (!passed) throw new Error(`Smoke check failed for ${path}`);
  console.info(`Smoke check passed for ${path}`);
}

const privateCheck = await fetch(new URL("/api/admin/system", origin), {
  headers,
  redirect: "error",
  signal: AbortSignal.timeout(8000),
});
if (privateCheck.status !== 401)
  throw new Error("Admin system access control smoke check failed.");
