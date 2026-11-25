import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const password = "drive-it-over-long-off";
const adminEmail = `admin-${randomUUID()}@example.test`;
const adminPassword = "safe-control-room-password";
const origin = "http://localhost:3100";

function userEmail() {
  return `player-${randomUUID()}@example.test`;
}

async function emailLink(email: string, subject: string) {
  const directory = process.env.PITCHMATE_E2E_MAIL_DIR!;
  let link: string | undefined;
  await expect
    .poll(
      async () => {
        for (const file of (await readdir(directory)).filter((name) =>
          name.endsWith(".json"),
        )) {
          const message = JSON.parse(
            await readFile(join(directory, file), "utf8"),
          );
          if (message.to === email && message.subject === subject) {
            link = message.link;
            return true;
          }
        }
        return false;
      },
      { timeout: 15_000 },
    )
    .toBe(true);
  return link!;
}

async function verifyAccount(page: Page, email: string) {
  await page.goto(await emailLink(email, "Verify your PitchMate email"));
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Verify email" }).click();
  await expect(page.getByRole("status")).toContainText("Email verified");
}

async function login(page: Page, email: string, secret = password) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(secret);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
}

test("mobile landing page leads to live discovery and offers navigation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Your Game.*Your Pitch/ }),
  ).toBeVisible();
  const themeToggle = page.getByRole("button", { name: "Switch color theme" });
  await themeToggle.click();
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);
  await expect(themeToggle.locator("svg.lucide-sun")).toBeVisible();
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);
  await themeToggle.click();
  await expect(page.locator("html")).toHaveClass(/\blight\b/);
  await expect(themeToggle.locator("svg.lucide-moon")).toBeVisible();
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(
    page.getByRole("dialog").getByRole("link", { name: "How it works" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Search turfs" }).click();
  await expect(
    page.getByRole("heading", { name: "Explore cricket turfs" }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
});

test("light and dark themes are keyboard accessible and persist across reloads", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  const root = page.locator("html");
  const themeToggle = page.getByRole("button", { name: "Switch color theme" });
  await expect(root).toHaveClass(/\blight\b/);

  for (const { theme, key } of [
    { theme: "dark", key: "Enter" },
    { theme: "light", key: "Space" },
  ]) {
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("link", { name: "Skip to content" }),
    ).toBeFocused();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await expect(themeToggle).toBeFocused();
    await page.keyboard.press(key);
    await expect(root).toHaveClass(new RegExp(`\\b${theme}\\b`));

    await page.emulateMedia({
      colorScheme: theme === "dark" ? "light" : "dark",
    });
    await page.reload();
    await expect(root).toHaveClass(new RegExp(`\\b${theme}\\b`));
    const audit = await new AxeBuilder({ page })
      .withRules("color-contrast")
      .analyze();
    expect(
      audit.violations.flatMap(({ nodes }) =>
        nodes.map(({ target }) => target),
      ),
      `${theme} mode color contrast`,
    ).toEqual([]);
  }
});

test("health, unauthenticated access, body validation, and origin protection", async ({
  page,
  request,
}) => {
  const health = await request.get("/api/health");
  expect(health.status()).toBe(200);
  expect(await health.json()).toMatchObject({
    success: true,
    data: { status: "ok" },
  });
  expect((await request.get("/api/users/me")).status()).toBe(401);
  for (const path of ["/dashboard", "/owner/dashboard", "/admin/dashboard"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
  }
  const bad = await request.post("/api/auth/register", {
    headers: { origin },
    data: { role: "ADMIN" },
  });
  expect(bad.status()).toBe(422);
  expect(await bad.json()).toMatchObject({
    success: false,
    error: { code: "VALIDATION_ERROR" },
  });
  const crossOrigin = await request.post("/api/auth/register", {
    headers: { origin: "https://foreign.example" },
    data: {},
  });
  expect(crossOrigin.status()).toBe(403);
});

test("player registers, verifies, edits profile, signs out and resets password", async ({
  page,
}) => {
  const email = userEmail();
  await page.goto("/register");
  await page.getByLabel("Full name").fill("Anika Rao");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create player account" }).click();
  await expect(page.getByRole("status")).toContainText("Account created");
  await verifyAccount(page, email);
  await login(page, email);
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(
    page.getByRole("heading", { name: "Welcome, Anika" }),
  ).toBeVisible();

  await page.goto("/admin/dashboard");
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/owner/dashboard");
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.getByRole("link", { name: "Profile", exact: true }).click();
  await page.getByLabel("Full name").fill("Anika Sen");
  await page.getByLabel("Phone number (optional)").fill("+91 98765 43210");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByText("Profile updated.")).toBeVisible();
  const profile = await page.request.get("/api/users/me");
  expect(await profile.json()).toMatchObject({
    data: { user: { name: "Anika Sen", role: "CUSTOMER" } },
  });

  await page.getByRole("link", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/$/);
  expect((await page.request.get("/api/users/me")).status()).toBe(401);

  await page.goto("/forgot-password");
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByRole("status")).toContainText("receive a reset link");
  await page.goto(await emailLink(email, "Reset your PitchMate password"));
  const replacement = "send-it-over-the-sightscreen";
  await page.getByLabel("New password").fill(replacement);
  await page.getByRole("button", { name: "Reset password" }).click();
  await expect(page.getByRole("status")).toContainText("Password reset");
  await login(page, email, replacement);
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole("link", { name: "Settings" }).click();
  await page.getByLabel("Current password").fill(replacement);
  await page.getByLabel("New password").fill(password);
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page.getByRole("status")).toContainText("Password changed");
  expect((await page.request.get("/api/users/me")).status()).toBe(401);
});

test("owner registers and lands in a dashboard with pending verification", async ({
  page,
}) => {
  const email = userEmail();
  await page.goto("/register-owner");
  await page.getByLabel("Full name").fill("Meera Rao");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Business name").fill("Yorker Cricket Club");
  await page.getByLabel("Business phone").fill("+91 98765 43210");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create owner account" }).click();
  await expect(page.getByRole("status")).toContainText("Owner account created");
  await verifyAccount(page, email);
  await login(page, email);
  await expect(page).toHaveURL(/\/owner\/dashboard$/);
  await expect(page.getByText("Pending review", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Booking Calendar" }).click();
  await expect(page.getByText(/requires owner approval/)).toBeVisible();
  await page.goto("/admin/dashboard");
  await expect(page).toHaveURL(/\/owner\/dashboard$/);
});

test("a development-provisioned admin can read the admin dashboard", async ({
  page,
}) => {
  execFileSync("bun", ["run", "db:seed"], {
    env: {
      ...process.env,
      DATABASE_URL: process.env.TEST_DATABASE_URL,
      NODE_ENV: "development",
      SEED_ADMIN_EMAIL: adminEmail,
      SEED_ADMIN_PASSWORD: adminPassword,
    },
    stdio: "pipe",
  });
  await login(page, adminEmail, adminPassword);
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
  await expect(page.getByText("Registered accounts")).toBeVisible();
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
  await page.getByRole("link", { name: "Audit Logs" }).click();
  await expect(page.getByRole("table")).toContainText("ADMIN_PROVISIONED");
  await page.getByRole("link", { name: "System operations" }).click();
  await expect(
    page.getByRole("heading", { name: "System operations" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Scheduled jobs" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Integrity audit" }).click();
  await expect(
    page.getByRole("heading", { name: "Database integrity" }),
  ).toBeVisible();
  await expect(page.getByRole("table")).toContainText(
    "overlapping active bookings",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("link", { name: "Dashboard", exact: true }),
  ).toHaveAttribute("href", "/admin/dashboard");
  const logout = page.getByRole("button", { name: "Log out" });
  await expect(logout).toBeVisible();
  const signedOut = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/auth/signout" &&
      response.request().method() === "POST",
  );
  await logout.click();
  expect((await signedOut).ok()).toBeTruthy();
  await expect(
    page.getByRole("banner").getByRole("link", { name: "Log in" }),
  ).toBeVisible();
  expect((await page.request.get("/api/users/me")).status()).toBe(401);
});
