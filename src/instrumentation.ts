import type { Instrumentation } from "next";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    if (process.env.NODE_ENV === "development") {
      const {
        getDefaultAutoSelectFamilyAttemptTimeout,
        setDefaultAutoSelectFamilyAttemptTimeout,
      } = await import("node:net");
      // Allow hosted database connections over higher-latency development links.
      setDefaultAutoSelectFamilyAttemptTimeout(
        Math.max(getDefaultAutoSelectFamilyAttemptTimeout(), 1_000),
      );
    }
    const { getEnv } = await import("./lib/env");
    const { venueSettings } = await import("./modules/venues/settings");
    const { validateDeployment } = await import("./lib/deployment");
    venueSettings();
    if (
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT ||
      process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT ||
      process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT
    ) {
      const { registerMonitoring } = await import("./lib/otel");
      registerMonitoring();
    }
    validateDeployment();
    process.env.NEXTAUTH_URL = getEnv().APP_URL;
  }
}

export const onRequestError: Instrumentation.onRequestError = async (
  _error,
  request,
  context,
) => {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { log } = await import("./lib/log");
    log("error", "next.request_error", {
      route: context.routePath,
      method: request.method,
    });
  }
};
