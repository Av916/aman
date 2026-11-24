import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

type Level = "debug" | "info" | "warn" | "error";
type Field =
  | "route"
  | "method"
  | "status"
  | "durationMs"
  | "code"
  | "job"
  | "runId"
  | "requestId";
const levels: Level[] = ["debug", "info", "warn", "error"];
const scope = new AsyncLocalStorage<string>();

export function requestScope<T>(work: (id: string) => Promise<T>) {
  const id = randomUUID();
  return scope.run(id, () => work(id));
}

export function log(
  level: Level,
  event: string,
  fields: Partial<Record<Field, string | number>> = {},
) {
  const setting = process.env.LOG_LEVEL as Level;
  if (levels.indexOf(level) < Math.max(0, levels.indexOf(setting || "info")))
    return;
  // Callers provide machine codes and static operation labels, never request bodies or errors.
  const allowed: Field[] = [
    "route",
    "method",
    "status",
    "durationMs",
    "code",
    "job",
    "runId",
    "requestId",
  ];
  const accepted = Object.fromEntries(
    allowed.flatMap((key) =>
      fields[key] === undefined ? [] : [[key, fields[key]]],
    ),
  );
  const record = {
    timestamp: new Date().toISOString(),
    level,
    event,
    environment: process.env.APP_ENV ?? process.env.NODE_ENV,
    requestId: scope.getStore(),
    ...accepted,
  };
  const line = JSON.stringify(record);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

export function routeLabel(path: string) {
  return path
    .split("/")
    .map((segment, index, segments) =>
      /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(segment) ||
      (segments[index - 1] === "venues" &&
        !["venues", "sitemap"].includes(segment)) ||
      segment.length > 40 ||
      (Boolean(segment) && !/^[a-z][a-z-]+$/i.test(segment))
        ? ":resource"
        : segment,
    )
    .join("/");
}
