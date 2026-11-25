import { createHmac, randomUUID } from "node:crypto";
import { Pool } from "pg";
import { hashPassword } from "../../src/modules/auth/crypto";
import { expect, test } from "@playwright/test";

const origin = "http://localhost:3100";

test("player finds a pitch, books consecutive slots with equipment, pays and downloads a receipt", async ({
  page,
  request,
}) => {
  const db = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
  const ownerId = randomUUID();
  const customerId = randomUUID();
  const venueId = randomUUID();
  const pitchId = randomUUID();
  const short = venueId.slice(0, 8);
  const venueName = `Straight Drive Stadium ${short}`;
  const slug = `straight-drive-${short}`;
  const email = `booking-${short}@example.test`;
  const password = "leave-the-ball-outside-off";
  const tomorrow = new Date(Date.now() + 86400_000);
  const date = new Intl.DateTimeFormat("sv-SE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Kolkata",
  }).format(tomorrow);
  const start = +new Date(`${date}T10:00:00+05:30`);
  const weekday = new Date(date + "T00:00:00Z").getUTCDay();

  try {
    await db.query(
      'INSERT INTO "User"(id,name,email,role,"passwordHash","emailVerified","updatedAt") VALUES ($1,$2,$3,$4,$5,now(),now()),($6,$7,$8,$9,NULL,now(),now())',
      [
        customerId,
        "Booking Player",
        email,
        "CUSTOMER",
        await hashPassword(password),
        ownerId,
        "Booking Owner",
        `owner-${short}@example.test`,
        "OWNER",
      ],
    );
    await db.query(
      'INSERT INTO "Venue"(id,"ownerId",name,slug,city,address,description,status,"publishedAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,now(),now())',
      [
        venueId,
        ownerId,
        venueName,
        slug,
        "Ludhiana",
        "Fixture stadium road",
        "Book the main pitch for this isolated test",
        "APPROVED",
      ],
    );
    await db.query(
      'INSERT INTO "Pitch"(id,"venueId",name,"pitchType","surfaceType",capacity,"lengthInMeters","widthInMeters","basePrice","slotDurationMinutes","minimumBookingMinutes","updatedAt") VALUES ($1,$2,$3,$4,$5,12,35,20,80000,30,60,now())',
      [pitchId, venueId, "Floodlit ground", "BOX_CRICKET", "ARTIFICIAL_TURF"],
    );
    await db.query(
      'INSERT INTO "OperatingHours"(id,"pitchId","dayOfWeek","openingTime","closingTime","updatedAt") VALUES ($1,$2,$3,600,660,now())',
      [randomUUID(), pitchId, weekday],
    );
    await db.query(
      'INSERT INTO "Addon"(id,"venueId",name,price,"pricingType","updatedAt") VALUES ($1,$2,$3,20000,$4,now())',
      [randomUUID(), venueId, "Cricket bat", "PER_BOOKING"],
    );
    for (let index = 0; index < 2; index++)
      await db.query(
        'INSERT INTO "Slot"(id,"pitchId","startAt","endAt",price,"hourlyPrice","updatedAt") VALUES ($1,$2,$3,$4,40000,80000,now())',
        [
          randomUUID(),
          pitchId,
          new Date(start + index * 1800_000),
          new Date(start + (index + 1) * 1800_000),
        ],
      );

    await page.route("**/__pitchmate_test_capture", async (route) => {
      const { order } = route.request().postDataJSON();
      const captured = await fetch(
        `http://127.0.0.1:3112/test-capture/${order}`,
        { method: "POST" },
      );
      const payment = (await captured.json()) as { id: string };
      const signature = createHmac("sha256", "pitchmate-mock-checkout-secret")
        .update(`${order}|${payment.id}`)
        .digest("hex");
      await route.fulfill({
        json: {
          razorpay_order_id: order,
          razorpay_payment_id: payment.id,
          razorpay_signature: signature,
        },
      });
    });
    await page.route("https://checkout.razorpay.com/v1/checkout.js", (route) =>
      route.fulfill({
        contentType: "application/javascript",
        body: `window.Razorpay = class { constructor(options) { this.options = options } on(){} async open(){ const response = await fetch('/__pitchmate_test_capture', { method: 'POST', body: JSON.stringify({order: this.options.order_id}) }); this.options.handler(await response.json()) } };`,
      }),
    );
    await page.route("https://tile.openstreetmap.org/**", (route) =>
      route.abort(),
    );
    expect(
      (await request.post("/api/internal/jobs/expire-bookings")).status(),
    ).toBe(401);

    await page.goto("/login");
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto(`/turfs?q=${encodeURIComponent(venueName)}`);
    await expect(page.getByRole("heading", { name: venueName })).toBeVisible();
    await page.getByRole("link", { name: "View details" }).click();
    await page.getByLabel("Availability date").fill(date);
    await expect(page).toHaveURL(new RegExp(`date=${date}$`));
    const available = page.getByRole("button", { name: /, Available,/ });
    await expect(available).toHaveCount(2);
    await available.first().click();
    await available.first().click();
    await page.getByLabel("Add Cricket bat").check();
    await expect(
      page.getByText("Total payable", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Continue to checkout" }).click();
    await expect(page).toHaveURL(/\/checkout\/[a-f0-9-]+$/);
    const bookingId = new URL(page.url()).pathname.split("/").at(-1)!;
    await expect(
      page.getByText("Hold remaining", { exact: true }),
    ).toBeVisible();
    expect((await request.get(`/api/bookings/${bookingId}`)).status()).toBe(
      401,
    );
    expect(
      (await page.request.get(`/api/bookings/${bookingId}/receipt`)).status(),
    ).toBe(409);
    await page.getByLabel("Phone number").fill("+91 98765 43210");
    await page.getByLabel(/I understand that my hold expires/).check();
    await page.getByRole("button", { name: "Save contact details" }).click();
    await expect
      .poll(
        async () =>
          (
            await db.query(
              'SELECT "customerPhone" FROM "Booking" WHERE id = $1',
              [bookingId],
            )
          ).rows[0]?.customerPhone,
      )
      .toBe("+91 98765 43210");
    await page.reload();
    await expect(page.getByLabel("Phone number")).toHaveValue(
      "+91 98765 43210",
    );
    await expect(
      page.getByLabel(/I understand that my hold expires/),
    ).toBeChecked();
    await page.getByRole("button", { name: /^Pay ₹/ }).click();
    await expect(
      page.getByRole("heading", { name: "Booking confirmed" }),
    ).toBeVisible();
    const receipt = await page.request.get(
      `/api/bookings/${bookingId}/receipt`,
    );
    expect(receipt.status()).toBe(200);
    expect((await receipt.body()).subarray(0, 4).toString()).toBe("%PDF");
    const calendar = await page.request.get(
      `/api/bookings/${bookingId}/calendar`,
    );
    expect(await calendar.text()).toContain("BEGIN:VEVENT");
    await page.getByRole("link", { name: "My Bookings" }).click();
    await expect(page.getByRole("heading", { name: venueName })).toBeVisible();
    await db.query(
      `UPDATE "Booking"
       SET "startAt" = now() - interval '2 hours', "endAt" = now() - interval '1 hour'
       WHERE id = $1`,
      [bookingId],
    );
    await page.reload();
    await expect(page.getByRole("heading", { name: venueName })).toHaveCount(0);
    await page.getByRole("link", { name: "Past confirmed" }).click();
    await expect(page.getByRole("heading", { name: venueName })).toBeVisible();
    await page
      .getByRole("link", { name: "Notifications", exact: true })
      .click();
    await expect(
      page.getByText("Booking confirmed", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Mark all as read" }).click();
    await expect(page.getByText("0 unread", { exact: true })).toBeVisible();
    expect(
      (
        await page.request.post("/api/bookings", {
          headers: { origin },
          data: { totalAmount: 1 },
        })
      ).status(),
    ).toBe(422);
  } finally {
    await db.end();
  }
});
