const connectionErrors = new Set([
  "ETIMEDOUT",
  "ECONNREFUSED",
  "ECONNRESET",
  "P1001",
  "P1002",
  "P1017",
  "P2024",
]);

export function errorCode(error: unknown) {
  if (error && typeof error === "object" && "code" in error)
    return typeof error.code === "string" ? error.code : undefined;
}

export function databaseConnectionErrorCode(error: unknown) {
  const code = errorCode(error);
  return code && connectionErrors.has(code) ? code : undefined;
}
