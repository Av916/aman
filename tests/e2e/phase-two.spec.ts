import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { hashPassword } from "../../src/modules/auth/crypto";
import { expect, test, type Page } from "@playwright/test";

const password = "pitchmate-e2e-drive-over-mid-on";
const origin = "http://localhost:3100";

async function signIn(page: Page, email: string, url = "/login") {
  await page.goto(url);
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
}

test("verified owner onboards a venue, admin approves it, and a player saves it", async ({
  page,
  browser,
  request,
}) => {
  const fixture = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
  const suffix = randomUUID().slice(0, 8);
  const title = `Cover Drive Arena ${suffix}`;
  const hash = await hashPassword(password);
  async function account(
    role: "OWNER" | "ADMIN" | "CUSTOMER",
    label = role.toLowerCase(),
  ) {
    const id = randomUUID();
    const email = `market-${label}-${suffix}@example.test`;
    await fixture.query(
      'INSERT INTO "User" (id, name, email, "passwordHash", role, "emailVerified", "updatedAt") VALUES ($1, $2, $3, $4, $5, now(), now())',
      [id, `Marketplace ${label}`, email, hash, role],
    );
    if (role === "OWNER")
      await fixture.query(
        'INSERT INTO "OwnerProfile" (id, "userId", "businessName", "businessPhone", "verificationStatus", "updatedAt") VALUES ($1, $2, $3, $4, $5, now())',
        [
          randomUUID(),
          id,
          "Marketplace Cricket",
          "+91 98765 43210",
          "APPROVED",
        ],
      );
    return { email };
  }
  try {
    const [owner, admin, player, competitor] = await Promise.all([
      account("OWNER"),
      account("ADMIN"),
      account("CUSTOMER"),
      account("OWNER", "other"),
    ]);
    expect((await request.get("/api/owner/venues")).status()).toBe(401);
    expect((await request.get("/api/admin/venues")).status()).toBe(401);
    await signIn(page, owner.email);
    await expect(page).toHaveURL(/\/owner\/dashboard$/);
    await page.getByRole("link", { name: "My Turfs" }).click();
    await page.getByRole("link", { name: "Create venue" }).click();
    await page.getByLabel("Venue name").fill(title);
    await page
      .getByLabel("Description", { exact: true })
      .fill("An outdoor cricket training venue in Chandigarh.");
    await page.getByLabel("Public contact phone").fill("+91 98765 43210");
    await page.getByLabel("Public contact email").fill("venue@example.test");
    await page.getByRole("button", { name: "Save and continue" }).click();
    await expect(page).toHaveURL(/step=2$/);
    const venueId = new URL(page.url()).pathname.split("/").at(-1)!;
    await page.getByLabel("Street address").fill("22 Sector Road");
    await page.getByLabel("Locality").fill("Sector 22");
    await page.getByLabel("City", { exact: true }).fill("Chandigarh");
    await page.getByLabel("State").fill("Chandigarh");
    await page.getByLabel("Postal code").fill("160022");
    await page.getByLabel("Latitude").fill("30.73");
    await page.getByLabel("Longitude").fill("76.78");
    await page.getByRole("button", { name: "Save and continue" }).click();
    await expect(page).toHaveURL(/step=3$/);
    await page.getByLabel("Floodlights").check();
    await page.getByRole("button", { name: "Save and continue" }).click();
    await expect(page).toHaveURL(/step=4$/);
    await page
      .getByLabel("Upload venue photos")
      .setInputFiles("public/images/boundary.webp");
    await page
      .getByLabel("Image description (optional)")
      .fill("Fenced cricket playing ground");
    await page.getByRole("button", { name: "Upload images" }).click();
    await expect(page.getByText("Cover photo", { exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Continue to pitches" }).click();
    await page.getByLabel("Pitch name").fill("Floodlit pitch");
    await page.getByRole("button", { name: "Add pitch", exact: true }).click();
    await expect(
      page.getByText("Floodlit pitch", { exact: true }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Continue to schedule" }).click();
    const tomorrow = new Date(Date.now() + 24 * 60 * 60_000);
    const weekday = new Intl.DateTimeFormat("en", {
      weekday: "long",
      timeZone: "Asia/Kolkata",
    }).format(tomorrow);
    const date = new Intl.DateTimeFormat("sv-SE", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: "Asia/Kolkata",
    }).format(tomorrow);
    await page
      .getByRole("group", { name: weekday, exact: true })
      .getByLabel("Closed")
      .uncheck();
    await page.getByRole("button", { name: "Save weekly schedule" }).click();
    await expect(
      page.getByText("Schedule saved and availability updated."),
    ).toBeVisible();
    await page.getByRole("link", { name: "Review venue" }).click();
    await page.getByRole("button", { name: "Submit for approval" }).click();
    await expect(
      page.getByText("Pending Approval", { exact: true }),
    ).toBeVisible();
    const {
      rows: [record],
    } = await fixture.query<{
      slug: string;
      pitchId: string;
      imageUrl: string;
    }>(
      'SELECT v.slug, p.id AS "pitchId", i."imageUrl" FROM "Venue" v JOIN "Pitch" p ON p."venueId" = v.id JOIN "VenueImage" i ON i."venueId" = v.id WHERE v.id = $1',
      [venueId],
    );
    expect((await request.get(`/api/venues/${record.slug}`)).status()).toBe(
      404,
    );
    expect((await request.get(record.imageUrl)).status()).toBe(404);
    expect(
      (
        await page.request.post(`/api/admin/venues/${venueId}/approve`, {
          headers: { origin },
        })
      ).status(),
    ).toBe(403);

    const otherPage = await browser.newPage({ baseURL: origin });
    await signIn(otherPage, competitor.email);
    await expect(otherPage).toHaveURL(/\/owner\/dashboard$/);
    expect(
      (
        await otherPage.request.patch(`/api/owner/venues/${venueId}`, {
          headers: { origin },
          data: { name: "Unauthorized change" },
        })
      ).status(),
    ).toBe(404);
    await otherPage.close();

    const adminPage = await browser.newPage({ baseURL: origin });
    await adminPage.route("https://tile.openstreetmap.org/**", (route) =>
      route.abort(),
    );
    await signIn(adminPage, admin.email);
    await expect(adminPage).toHaveURL(/\/admin\/dashboard$/);
    await adminPage.getByRole("link", { name: "Turf Management" }).click();
    await adminPage.getByLabel("Search venues").fill(title);
    await adminPage
      .getByRole("button", { name: "Filter", exact: true })
      .click();
    await adminPage.getByRole("link", { name: "Review venue" }).click();
    await adminPage.getByRole("button", { name: "Approve venue" }).click();
    await adminPage
      .getByRole("dialog")
      .getByRole("button", { name: "Confirm", exact: true })
      .click();
    await expect(
      adminPage.getByText("Venue Approved", { exact: true }),
    ).toBeVisible();
    await adminPage.close();

    await page.reload();
    await page.getByRole("button", { name: "Publish listing" }).click();
    await expect(
      page.getByText("This listing is visible in discovery."),
    ).toBeVisible();
    expect((await request.get(record.imageUrl)).status()).toBe(200);
    const slots = await request.get(
      `/api/pitches/${record.pitchId}/availability?date=${date}`,
    );
    expect((await slots.json()).data.slots.length).toBeGreaterThan(0);

    const guest = await browser.newPage({
      baseURL: origin,
      viewport: { width: 390, height: 844 },
    });
    await guest.route("https://tile.openstreetmap.org/**", (route) =>
      route.abort(),
    );
    await guest.goto(
      `/turfs?q=${encodeURIComponent(title)}&city=Chandigarh&date=${date}`,
    );
    await expect(guest.getByRole("heading", { name: title })).toBeVisible();
    await guest.getByRole("button", { name: "Filters", exact: true }).click();
    await expect(
      guest.getByRole("dialog", { name: "Filter turfs" }),
    ).toBeVisible();
    await guest.keyboard.press("Escape");
    await guest.getByRole("link", { name: "View details" }).click();
    await expect(
      guest.getByRole("heading", { name: "Pitch availability" }),
    ).toBeVisible();
    await guest
      .getByRole("button", { name: `Save ${title} to favorites` })
      .click();
    await expect(guest).toHaveURL(/\/login\?next=/);
    await signIn(guest, player.email, guest.url());
    await expect(guest).toHaveURL(new RegExp(`/turfs/${record.slug}$`));
    await guest
      .getByRole("button", { name: `Save ${title} to favorites` })
      .click();
    await expect(
      guest.getByRole("button", { name: `Remove ${title} from favorites` }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(guest.getByText("Saved to favorites.")).toBeVisible();
    await guest.goto("/dashboard/favorites");
    await expect(guest.getByRole("heading", { name: title })).toBeVisible();
    await guest
      .getByRole("button", { name: `Remove ${title} from favorites` })
      .click();
    await expect(
      guest.getByRole("heading", { name: "No saved venues" }),
    ).toBeVisible();
    await guest.close();
    expect((await request.get(`/api/venues/${record.slug}`)).status()).toBe(
      200,
    );
    expect(
      (
        await page.request.patch(`/api/owner/venues/${venueId}`, {
          headers: { origin },
          data: { name: title + " updated" },
        })
      ).status(),
    ).toBe(200);
    expect((await request.get(`/api/venues/${record.slug}`)).status()).toBe(
      404,
    );
  } finally {
    await fixture.end();
  }
});
