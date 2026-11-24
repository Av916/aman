import { registerOTel } from "@vercel/otel";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import type { SpanExporter } from "@opentelemetry/sdk-trace-base";
import { sanitizeTraceAttributes } from "./trace-policy";

function sanitizedExporter(exporter: OTLPTraceExporter): SpanExporter {
  return {
    export(spans, callback) {
      const safe = spans.map((span) => {
        const attributes = sanitizeTraceAttributes(span.attributes);
        return {
          ...span,
          spanContext: () => span.spanContext(),
          attributes,
          name: String(attributes["next.span_type"] ?? "pitchmate.operation"),
          events: [],
          links: [],
          status: { code: span.status.code },
        };
      });
      exporter.export(safe, callback);
    },
    shutdown: () => exporter.shutdown(),
    forceFlush: () => exporter.forceFlush(),
  };
}

export function registerMonitoring() {
  const standard = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  const traces = standard || process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT;
  const metrics = standard || process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT;
  if (!traces && !metrics) return;
  // An explicit processor prevents the default exporter from sending a
  // second unsanitized copy when the standard OTLP environment is set.
  registerOTel({
    serviceName: "pitchmate",
    spanProcessors: traces
      ? [new BatchSpanProcessor(sanitizedExporter(new OTLPTraceExporter()))]
      : [],
    metricReaders: metrics
      ? [
          new PeriodicExportingMetricReader({
            exporter: new OTLPMetricExporter(),
            exportIntervalMillis: 30000,
          }),
        ]
      : [],
  });
}
