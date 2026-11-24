import "dotenv/config";
import { mkdtemp, chmod, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import pg from "pg";

const exec = promisify(execFile);
const source = new URL(process.env.TEST_DATABASE_URL ?? "");
const target = new URL(process.env.RESTORE_TEST_DATABASE_URL ?? "");
const loopback = (url: URL) =>
  ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
if (
  !loopback(source) ||
  !loopback(target) ||
  source.pathname === target.pathname ||
  !source.pathname.endsWith("_test") ||
  !target.pathname.endsWith("_restore")
)
  throw new Error(
    "Restore drills require distinct loopback _test and _restore databases.",
  );

const dir = await mkdtemp(join(tmpdir(), "pitchmate-restore-"));
const file = join(dir, "database.dump");
const started = performance.now();
const { Client } = pg;
function environment(url: URL) {
  const {
    PGDATABASE: _database,
    PGPASSWORD: _password,
    PGHOST: _host,
    PGUSER: _user,
    PGPORT: _port,
    ...env
  } = process.env;
  void [_database, _password, _host, _user, _port];
  return {
    ...env,
    PGHOST: url.hostname,
    PGPORT: url.port || "5432",
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: url.pathname.slice(1),
  };
}
const tables = [
  "Venue",
  "Booking",
  "Payment",
  "Refund",
  "FinancialTransaction",
  "OutboxEvent",
  "_prisma_migrations",
];
async function counts(url: URL) {
  const client = new Client({ connectionString: url.href });
  await client.connect();
  try {
    return await Promise.all(
      tables.map(async (table) => {
        const result = await client.query(
          `SELECT count(*)::text AS count FROM "${table}"`,
        );
        return { table, records: Number(result.rows[0].count) };
      }),
    );
  } finally {
    await client.end();
  }
}
try {
  const check = new Client({ connectionString: target.href });
  await check.connect();
  try {
    const { rows } = await check.query(
      "SELECT count(*)::int AS count FROM pg_tables WHERE schemaname = 'public'",
    );
    if (rows[0].count !== 0)
      throw new Error("The restore target must be empty.");
  } finally {
    await check.end();
  }
  const baseline = await counts(source);
  await exec(
    "pg_dump",
    ["--format=custom", "--no-owner", "--no-privileges", "--file", file],
    { env: environment(source) },
  );
  await chmod(file, 0o600);
  await exec(
    "pg_restore",
    [
      "--no-owner",
      "--no-privileges",
      "--exit-on-error",
      "--single-transaction",
      "--dbname",
      target.pathname.slice(1),
      file,
    ],
    { env: environment(target) },
  );
  const restored = await counts(target);
  if (JSON.stringify(restored) !== JSON.stringify(baseline))
    throw new Error("Restored counts did not match the quiescent source.");
  console.info(
    JSON.stringify(
      { durationMs: Math.round(performance.now() - started), restored },
      null,
      2,
    ),
  );
} finally {
  await rm(dir, { recursive: true, force: true });
}
