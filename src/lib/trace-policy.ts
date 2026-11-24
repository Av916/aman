import type { Attributes } from "@opentelemetry/api";

const methods = new Set([
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
]);
export function sanitizeTraceAttributes(attributes: Attributes): Attributes {
  return Object.fromEntries(
    Object.entries(attributes).filter(([key, value]) => {
      if (key === "next.span_type")
        return (
          typeof value === "string" && /^Next[A-Za-z0-9_.]{1,70}$/.test(value)
        );
      if (key === "http.method" || key === "http.request.method")
        return typeof value === "string" && methods.has(value);
      if (key === "http.status_code" || key === "http.response.status_code")
        return (
          typeof value === "number" &&
          Number.isInteger(value) &&
          value >= 100 &&
          value <= 599
        );
      return false;
    }),
  );
}
