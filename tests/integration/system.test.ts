import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { getPrisma } from "@/lib/prisma";
import { limitAttempt } from "@/modules/auth/rate-limit";
import { runJob } from "@/modules/system/jobs";
import { auditIntegrity } from "@/modules/system/integrity";

const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url)("Production operations persistence", () => {
  beforeAll(() => {
    if (!url || url === process.env.DATABASE_URL)
      throw new Error("Use a separate test database.");
    process.env.DATABASE_URL = url;
  });
  afterAll(() => getPrisma().$disconnect());

  it("serializes shared rate-limit updates and reports expiry", async () => {
    const scope = `test:${randomUUID()}`;
    const outcomes = await Promise.allSettled(
      Array.from({ length: 8 }, () =>
        limitAttempt(scope, new Headers(), "account", {
          global: 100,
          ip: 100,
          identity: 4,
          seconds: 60,
        }),
      ),
    );
    expect(outcomes.filter((item) => item.status === "fulfilled")).toHaveLength(
      4,
    );
    for (const outcome of outcomes)
      if (outcome.status === "rejected") {
        expect(outcome.reason).toMatchObject({ status: 429 });
        expect(outcome.reason.retryAfter).toBeGreaterThan(0);
      }
  });

  it("skips a live lease and recovers an abandoned job", async () => {
    const db = getPrisma();
    const abandoned = randomUUID();
    await db.jobLease.upsert({
      where: { name: "availability" },
      create: {
        name: "availability",
        token: abandoned,
        expiresAt: new Date(Date.now() + 60_000),
      },
      update: { token: abandoned, expiresAt: new Date(Date.now() + 60_000) },
    });
    const run = await db.jobRun.create({
      data: { id: abandoned, name: "availability", status: "RUNNING" },
    });
    expect(await runJob("availability")).toEqual({ skipped: true });
    await db.jobLease.update({
      where: { name: "availability" },
      data: { expiresAt: new Date(0) },
    });
    const results = await Promise.all([
      runJob("availability", async () => ({ result: { scanned: 0 } })),
      runJob("availability", async () => ({ result: { scanned: 0 } })),
    ]);
    expect(results.some((result) => !result.skipped)).toBe(true);
    expect(
      (await db.jobRun.findUniqueOrThrow({ where: { id: run.id } })).status,
    ).toBe("INTERRUPTED");
  });

  it("runs the read-only audit without returning booking or account identifiers", async () => {
    const rows = await auditIntegrity();
    expect(rows.length).toBeGreaterThan(8);
    expect(
      rows.every((row) => Object.keys(row).sort().join(",") === "check,count"),
    ).toBe(true);
  });
});
