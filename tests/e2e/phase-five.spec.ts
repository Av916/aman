import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("public health, crawler boundaries, and operations authorization", async ({
  request,
}) => {
  for (const path of ["/api/health/live", "/api/health/ready"]) {
    const result = await request.get(path);
    expect(result.status()).toBe(200);
    expect(await result.json()).toEqual({ status: "ok" });
    expect(result.headers()["cache-control"]).toBe("no-store");
  }
  for (const path of [
    "/api/admin/system",
    "/api/admin/system/integrity",
    "/api/internal/cron/expire",
  ]) {
    expect((await request.get(path)).status()).toBe(401);
  }
  const checkout = await request.get(
    "/checkout/00000000-0000-4000-8000-000000000001",
    { maxRedirects: 0 },
  );
  expect(checkout.headers()["x-robots-tag"]).toContain("noindex");
  const robots = await request.get("/robots.txt");
  expect(await robots.text()).toContain("Disallow: /checkout/");
  const listing = await request.get("/sitemap.xml");
  expect(await listing.text()).toContain("/turfs");
  expect(await listing.text()).not.toContain("/admin/");
  const page = await request.get("/");
  const csp =
    page.headers()["content-security-policy-report-only"] ??
    page.headers()["content-security-policy"];
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).toContain("checkout.razorpay.com");
  expect(page.headers()["x-content-type-options"]).toBe("nosniff");
});

test("public pages preserve keyboard navigation and selected WCAG AA rules", async ({
  page,
}) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to content" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeVisible();
  for (const path of ["/", "/turfs", "/contact", "/login"]) {
    await page.goto(path);
    const audit = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(
      audit.violations.map(({ id, nodes }) => ({
        id,
        targets: nodes.map((node) => node.target),
      })),
      path,
    ).toEqual([]);
  }
});

test("the offline worker stores only the public fallback", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect
    .poll(() =>
      page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
    )
    .toBe(true);
  await context.setOffline(true);
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "You’re offline" }),
  ).toBeVisible();
  const keys = await page.evaluate(async () => {
    const cache = await caches.open("pitchmate-public-offline-v1");
    return (await cache.keys()).map((item) => new URL(item.url).pathname);
  });
  expect(keys).toEqual(["/offline.html"]);
  await expect(
    page.goto("/checkout/00000000-0000-4000-8000-000000000001"),
  ).rejects.toThrow();
});
