import { sanitizeTraceAttributes } from "@/lib/trace-policy";
import { describe, expect, it } from "vitest";
import { AppError, endpoint, readBody } from "@/lib/api";
import { routeLabel } from "@/lib/log";
import { validJobToken } from "@/modules/payments/signatures";
import { z } from "zod";

describe("production security boundaries", () => {
  it("hides concrete resource IDs in request labels", () => {
    expect(
      routeLabel("/api/bookings/00000000-0000-4000-8000-000000000000/status"),
    ).toBe("/api/bookings/:resource/status");
    expect(routeLabel("/api/venues/sensitive-venue-slug")).toBe(
      "/api/venues/:resource",
    );
  });

  it("requires the expected origin and a strict JSON body", async () => {
    const request = new Request("http://localhost/api/test", {
      method: "POST",
      headers: {
        Origin: "https://example.invalid",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id: "test" }),
    });
    await expect(
      readBody(request, z.strictObject({ id: z.string() })),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("returns accurate retry timing and adds a fresh request ID", async () => {
    const handler = endpoint(async () => {
      throw new AppError(429, "RATE_LIMITED", "Please retry.", 13);
    });
    const a = await handler(new Request("http://localhost/api/test"));
    const b = await handler(new Request("http://localhost/api/test"));
    expect(a.status).toBe(429);
    expect(a.headers.get("retry-after")).toBe("13");
    expect(a.headers.get("x-request-id")).not.toBe(
      b.headers.get("x-request-id"),
    );
  });
  it("drops URL, query, header, body, and unrecognized trace attributes", () => {
    expect(
      sanitizeTraceAttributes({
        "http.request.method": "GET",
        "http.response.status_code": 200,
        "next.span_type": "NextNodeServer.findPageComponents",
        "next.route": "/reset-password?token=private",
        "url.full": "https://example.invalid/?token=private",
        "http.request.header.cookie": "sensitive",
      }),
    ).toEqual({
      "http.request.method": "GET",
      "http.response.status_code": 200,
      "next.span_type": "NextNodeServer.findPageComponents",
    });
  });

  it("keeps scheduler bearer tokens distinct and fails closed", () => {
    expect(
      validJobToken("Bearer local-job-credential", "local-job-credential"),
    ).toBe(true);
    expect(
      validJobToken("Bearer local-job-credential", "another-job-credential"),
    ).toBe(false);
    expect(validJobToken("Bearer local-job-credential", undefined)).toBe(false);
  });
});
