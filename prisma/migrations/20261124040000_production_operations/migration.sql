BEGIN;
CREATE TABLE "JobLease" (
  name TEXT PRIMARY KEY,
  token UUID NOT NULL,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  cursor UUID
);
CREATE TABLE "JobRun" (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('RUNNING', 'SUCCEEDED', 'FAILED', 'INTERRUPTED')),
  "startedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMPTZ(3),
  "errorCode" TEXT,
  result JSONB
);
CREATE INDEX "JobRun_name_startedAt_idx" ON "JobRun"(name, "startedAt");
CREATE INDEX "JobRun_startedAt_idx" ON "JobRun"("startedAt");
COMMIT;
