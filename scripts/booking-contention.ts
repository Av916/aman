import "dotenv/config";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { encode } from "next-auth/jwt";

const database = new URL(process.env.TEST_DATABASE_URL ?? "");
const first = new URL(process.env.LOAD_URL ?? "http://127.0.0.1:3105");
const second = new URL(process.env.LOAD_SECOND_URL ?? "http://127.0.0.1:3106");
const secret = process.env.AUTH_SECRET;
const isLocal = (url: URL) =>
  ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
if (
  !isLocal(database) ||
  !database.pathname.endsWith("_test") ||
  !isLocal(first) ||
  !isLocal(second) ||
  first.origin === second.origin ||
  !secret
)
  throw new Error(
    "Use two distinct loopback servers and an isolated test database.",
  );

const db = new pg.Client({ connectionString: database.href });
await db.connect();
try {
  const {
    rows: [fixture],
  } = await db.query<{ slot: string; pitch: string }>(`
    SELECT s.id AS slot, p.id AS pitch FROM "Slot" s JOIN "Pitch" p ON p.id=s."pitchId"
    JOIN "Venue" v ON v.id=p."venueId"
    WHERE s.status='AVAILABLE' AND s."startAt" > now() + interval '10 minutes'
      AND s."startAt" < now() + interval '3 days'
      AND p."minimumBookingMinutes" <= p."slotDurationMinutes" AND p."isActive"
      AND v.status='APPROVED' AND v."publishedAt" IS NOT NULL AND v."deletedAt" IS NULL
    ORDER BY s."startAt", s.id LIMIT 1
  `);
  if (!fixture)
    throw new Error(
      "Seed an eligible available pitch slot in the test database.",
    );
  const ids = Array.from({ length: 100 }, () => randomUUID());
  await db.query(
    `INSERT INTO "User" (id,email,name,"emailVerified","updatedAt")
    SELECT id,id::text||'@example.test','Load Fixture',now(),now() FROM unnest($1::uuid[]) AS id`,
    [ids],
  );
  const sessions = await Promise.all(
    ids.map((id) =>
      encode({ secret, token: { sub: id, sessionVersion: 0 }, maxAge: 120 }),
    ),
  );
  const headers = (token: string) => ({
    Origin: first.origin,
    Cookie: `next-auth.session-token=${token}`,
    "Content-Type": "application/json",
  });
  const selection = {
    pitchId: fixture.pitch,
    slotIds: [fixture.slot],
    addons: [],
  };
  const quoteResponse = await fetch(new URL("/api/bookings/quote", first), {
    method: "POST",
    headers: headers(sessions[0]),
    body: JSON.stringify(selection),
    redirect: "error",
  });
  if (!quoteResponse.ok)
    throw new Error(
      `Unable to quote the test fixture (HTTP ${quoteResponse.status}).`,
    );
  const {
    data: { quote },
  } = await quoteResponse.json();
  const results = await Promise.all(
    sessions.map(async (token, index) => {
      const start = performance.now();
      const host = index % 2 === 0 ? first : second;
      const response = await fetch(new URL("/api/bookings", host), {
        method: "POST",
        headers: { ...headers(token), "Idempotency-Key": randomUUID() },
        body: JSON.stringify({
          ...selection,
          quoteFingerprint: quote.fingerprint,
        }),
        redirect: "error",
        signal: AbortSignal.timeout(12000),
      });
      return {
        token,
        host,
        status: response.status,
        result: await response.json(),
        ms: performance.now() - start,
      };
    }),
  );
  const winners = results.filter((item) => item.status === 201);
  const conflicts = results.filter((item) => item.status === 409);
  const owner = await db.query<{ activeBookingId: string }>(
    'SELECT "activeBookingId" FROM "Slot" WHERE id = $1',
    [fixture.slot],
  );
  console.info(
    JSON.stringify({
      servers: [first.origin, second.origin],
      requests: results.length,
      winners: winners.length,
      conflicts: conflicts.length,
      unexpected: results
        .filter((item) => ![201, 409].includes(item.status))
        .map((item) => item.status),
      p95Ms: Math.round(
        results.map((item) => item.ms).sort((a, b) => a - b)[94],
      ),
    }),
  );
  if (
    winners.length !== 1 ||
    conflicts.length !== 99 ||
    owner.rows[0].activeBookingId !== winners[0].result.data.booking.id
  )
    throw new Error("Cross-instance inventory contention check failed.");
  const winner = winners[0];
  const release = await fetch(
    new URL(
      `/api/bookings/${winner.result.data.booking.id}/release`,
      winner.host,
    ),
    {
      method: "POST",
      headers: headers(winner.token),
      redirect: "error",
    },
  );
  if (!release.ok)
    throw new Error("Unable to release the winning test booking.");
} finally {
  await db.end();
}
