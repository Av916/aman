import { metrics } from "@opentelemetry/api";

const meter = metrics.getMeter("pitchmate");
const requests = meter.createCounter("http_request_count");
const errors = meter.createCounter("http_error_count");
const latency = meter.createHistogram("http_request_duration", { unit: "ms" });
const jobLatency = meter.createHistogram("job_execution_duration", {
  unit: "ms",
});
const webVitals = meter.createHistogram("browser_web_vital");
const bookingHolds = meter.createCounter("booking_hold_created");
const bookingConflicts = meter.createCounter("booking_hold_conflict");
const paymentErrors = meter.createCounter("payment_verification_failed");

export function recordHttp(
  route: string,
  method: string,
  status: number,
  duration: number,
) {
  const labels = { route, method, status };
  requests.add(1, labels);
  latency.record(duration, labels);
  if (status >= 500) errors.add(1, labels);
  if (route === "/api/bookings" && method === "POST") {
    if (status === 201) bookingHolds.add(1);
    if (status === 409) bookingConflicts.add(1);
  }
  if (route === "/api/payments/verify" && status >= 400) paymentErrors.add(1);
}

export function recordJob(name: string, status: string, duration: number) {
  jobLatency.record(duration, { job: name, status });
}

export function recordVital(name: string, value: number) {
  webVitals.record(value, { metric: name });
}
