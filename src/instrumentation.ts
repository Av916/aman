export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { getEnv } = await import("./lib/env");
    process.env.NEXTAUTH_URL = getEnv().APP_URL;
  }
}
