import { z } from "zod";
import { endpoint, readBody } from "@/lib/api";
import { recordVital } from "@/lib/metrics";
import { log } from "@/lib/log";
import { limitAttempt } from "@/modules/auth/rate-limit";

const payload = z.discriminatedUnion("event", [
  z.strictObject({ event: z.literal("client_error") }),
  z.strictObject({
    event: z.literal("web_vital"),
    name: z.enum(["CLS", "FCP", "INP", "LCP", "TTFB"]),
    value: z.number().min(0).max(600000),
  }),
]);
export const POST = endpoint(async (request) => {
  const event = await readBody(request, payload);
  await limitAttempt("client-telemetry", request.headers, undefined, {
    global: 8000,
    ip: 120,
    identity: 120,
    seconds: 60,
  });
  if (event.event === "client_error")
    log("error", "browser.error", { code: "CLIENT_RUNTIME_ERROR" });
  else {
    recordVital(event.name, event.value);
    log("info", "browser.web_vital", {
      code: event.name,
      durationMs: event.value,
    });
  }
  return new Response(null, { status: 204 });
});
