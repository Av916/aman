import { expect, test, type Page, type Browser } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { hashPassword } from "../../src/modules/auth/crypto";

const origin = "http://localhost:3100";
const zone = "Asia/Kolkata";
const password = "pitchmate-owner-local-testing";
const dateInVenue = (date: Date) =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);

async function account(browser: Browser, email: string, path: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(origin + "/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(path + "$"));
  return { page, close: () => context.close() };
}

async function fixture() {
  const db = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
  const ids = {
    owner: randomUUID(),
    customer: randomUUID(),
    staff: randomUUID(),
    admin: randomUUID(),
    venue: randomUUID(),
    otherVenue: randomUUID(),
    pitch: randomUUID(),
    slot: randomUUID(),
  };
  const key = ids.venue.slice(0, 8);
  const emails = Object.fromEntries(
    ["owner", "customer", "staff", "admin"].map((kind) => [
      kind,
      `ops-${kind}-${key}@example.test`,
    ]),
  );
  const venueName = `Covers Cricket ${key}`;
  const stageDate = dateInVenue(new Date(Date.now() + 2 * 86400_000));
  const start = new Date(stageDate + "T12:00:00+05:30");
  const hash = await hashPassword(password);
  for (const [kind, role] of [
    ["owner", "OWNER"],
    ["customer", "CUSTOMER"],
    ["staff", "CUSTOMER"],
    ["admin", "ADMIN"],
  ] as const)
    await db.query(
      'INSERT INTO "User"(id,name,email,role,"passwordHash","emailVerified","updatedAt") VALUES ($1,$2,$3,$4,$5,now(),now())',
      [ids[kind], `Operations ${kind}`, emails[kind], role, hash],
    );
  await db.query(
    'INSERT INTO "OwnerProfile"(id,"userId","businessName","businessPhone","verificationStatus","updatedAt") VALUES ($1,$2,$3,$4,$5,now())',
    [randomUUID(), ids.owner, venueName, "+919876543210", "APPROVED"],
  );
  for (const [id, name] of [
    [ids.venue, venueName],
    [ids.otherVenue, venueName + " Annex"],
  ])
    await db.query(
      'INSERT INTO "Venue"(id,"ownerId",name,slug,city,address,status,"publishedAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,now(),now())',
      [
        id,
        ids.owner,
        name,
        "covers-" + id,
        "Pune",
        "Fixture stadium road",
        "APPROVED",
      ],
    );
  await db.query(
    'INSERT INTO "Pitch"(id,"venueId",name,"pitchType","surfaceType",capacity,"lengthInMeters","widthInMeters","basePrice","slotDurationMinutes","minimumBookingMinutes","updatedAt") VALUES ($1,$2,$3,$4,$5,12,35,20,80000,30,30,now())',
    [ids.pitch, ids.venue, "Centre wicket", "BOX_CRICKET", "ARTIFICIAL_TURF"],
  );
  await db.query(
    'INSERT INTO "OperatingHours"(id,"pitchId","dayOfWeek","openingTime","closingTime","updatedAt") VALUES ($1,$2,$3,720,750,now())',
    [randomUUID(), ids.pitch, new Date(stageDate + "T00:00:00Z").getUTCDay()],
  );
  await db.query(
    'INSERT INTO "Slot"(id,"pitchId","startAt","endAt",price,"hourlyPrice","updatedAt") VALUES ($1,$2,$3,$4,40000,80000,now())',
    [ids.slot, ids.pitch, start, new Date(+start + 30 * 60000)],
  );
  return { db, ids, emails, venueName, stageDate };
}

const mutate = (page: Page, path: string, data: object) =>
  page.request.post(path, {
    data,
    headers: { origin, "Idempotency-Key": randomUUID() },
  });
test("owner manages a walk-in booking from the calendar through payment and attendance", async ({
  browser,
}) => {
  const { db, ids, emails, venueName, stageDate } = await fixture();
  const owner = await account(browser, emails.owner, "/owner/dashboard");
  const page = owner.page;
  try {
    await page.goto("/owner/calendar");
    await expect(
      page.getByRole("button", { name: /Centre wicket.*Available/ }),
    ).toBeVisible();
    await page
      .getByRole("combobox", { name: "Venue", exact: true })
      .selectOption({ label: venueName });
    await page.getByLabel("Date", { exact: true }).fill(stageDate);
    const calendarView = page.getByRole("combobox", {
      name: "View",
      exact: true,
    });
    await calendarView.selectOption("week");
    await expect(
      page.getByRole("button", { name: /Centre wicket.*Available/ }),
    ).toBeVisible();
    await calendarView.selectOption("month");
    await page
      .getByRole("button", { name: "0 bookings · 1 open slots", exact: true })
      .click();
    await expect(calendarView).toHaveValue("day");
    await page
      .getByRole("button", { name: /Centre wicket.*Available/ })
      .click();
    const booking = page.getByRole("dialog", { name: "New reservation" });
    await booking.getByLabel("Guest name").fill("Calendar Walk-In");
    await booking
      .getByRole("textbox", { name: "Phone", exact: true })
      .fill("+91 98765 43210");
    await booking.getByRole("button", { name: "Calculate price" }).click();
    await booking.getByRole("button", { name: "Confirm reservation" }).click();
    await page.getByRole("button", { name: /Calendar Walk-In/ }).click();
    const drawer = page.getByRole("dialog");
    await drawer.getByRole("button", { name: "Record payment" }).click();
    await drawer
      .getByRole("button", { name: "Confirm offline payment" })
      .click();
    await expect(drawer.getByText("Captured", { exact: true })).toBeVisible();
    const result = await db.query(
      'SELECT id FROM "Booking" WHERE "pitchId" = $1',
      [ids.pitch],
    );
    const bookingId = result.rows[0].id;
    await db.query(
      'UPDATE "Booking" SET "startAt" = now() - interval \'1 minute\', "endAt" = now() + interval \'29 minutes\' WHERE id = $1',
      [bookingId],
    );
    await drawer.getByRole("button", { name: "Check in", exact: true }).click();
    await drawer.getByRole("button", { name: "Confirm action" }).click();
    await expect(drawer.getByText("Checked in", { exact: true })).toBeVisible();
    await db.query(
      'UPDATE "Booking" SET "startAt" = now() - interval \'31 minutes\', "endAt" = now() - interval \'1 minute\' WHERE id = $1',
      [bookingId],
    );
    await drawer.getByRole("button", { name: "Mark completed" }).click();
    await drawer.getByRole("button", { name: "Confirm action" }).click();
    await expect(drawer.getByText("Completed", { exact: true })).toBeVisible();
    await page.goto("/owner/analytics");
    await page
      .getByRole("combobox", { name: "Venue", exact: true })
      .selectOption({ label: venueName });
    await expect(
      page.getByText("Offline payment", { exact: true }),
    ).toBeVisible();
    expect(
      (
        await page.request.get(`/api/owner/bookings/${bookingId}/receipt`)
      ).status(),
    ).toBe(200);
    async function measure(path: string) {
      const url = `${path}?venueId=${ids.venue}`;
      expect((await page.request.get(url)).status()).toBe(200);
      const measured: number[] = [];
      for (let batch = 0; batch < 5; batch++)
        await Promise.all(
          Array.from({ length: 4 }, async () => {
            const start = performance.now();
            const response = await page.request.get(url);
            expect(response.ok()).toBeTruthy();
            measured.push(performance.now() - start);
          }),
        );
      return Math.round(measured.sort((a, b) => a - b)[18]);
    }
    console.info("Phase 4 local API sample", {
      calendarP95Ms: await measure("/api/owner/calendar"),
      reservationsP95Ms: await measure("/api/owner/bookings"),
      analyticsP95Ms: await measure("/api/owner/analytics"),
      requestsPerEndpoint: 20,
    });
  } finally {
    await owner.close();
    await db.end();
  }
});

test("staff accepts an invitation, creates an assigned booking, and cannot export finance data", async ({
  browser,
}) => {
  const { db, ids, emails, stageDate } = await fixture();
  const owner = await account(browser, emails.owner, "/owner/dashboard");
  const staff = await account(browser, emails.staff, "/dashboard");
  try {
    const invited = await mutate(owner.page, "/api/owner/staff/invite", {
      email: emails.staff,
      role: "RECEPTIONIST",
      venueIds: [ids.venue],
    });
    expect(invited.status()).toBe(201);
    const {
      data: { invitation },
    } = await invited.json();
    const outbox = await db.query(
      'SELECT payload FROM "OutboxEvent" WHERE "aggregateId" = $1 AND "eventType" = $2',
      [invitation.id, "OPERATIONAL_EMAIL"],
    );
    const url = outbox.rows[0].payload.text.match(/https?:\/\/\S+$/)[0];
    await staff.page.goto(url);
    await staff.page.getByRole("button", { name: "Accept invitation" }).click();
    await staff.page
      .getByRole("link", { name: "Open assigned venues" })
      .click();
    await expect(
      staff.page.getByRole("heading", { name: "Booking calendar" }),
    ).toBeVisible();
    expect(
      (
        await staff.page.request.get(
          `/api/owner/calendar?venueId=${ids.otherVenue}`,
        )
      ).status(),
    ).toBe(404);
    expect(
      (
        await staff.page.request.get(
          `/api/owner/reports/export?kind=revenue&venueId=${ids.venue}`,
        )
      ).status(),
    ).toBe(403);
    const selection = { pitchId: ids.pitch, slotIds: [ids.slot], addons: [] };
    const quoted = await mutate(
      staff.page,
      "/api/owner/bookings/quote",
      selection,
    );
    expect(quoted.ok()).toBeTruthy();
    const {
      data: { quote },
    } = await quoted.json();
    const created = await mutate(staff.page, "/api/owner/bookings/manual", {
      ...selection,
      quoteFingerprint: quote.fingerprint,
      source: "PHONE",
      playerCount: 4,
      paymentMethod: "UNPAID",
      identity: {
        type: "guest",
        name: "Phone booking",
        phone: "+919876543210",
      },
    });
    expect(created.status()).toBe(201);
    const calendar = await staff.page.request.get(
      `/api/owner/calendar?venueId=${ids.venue}&from=${stageDate}&to=${stageDate}`,
    );
    const [phoneBooking] = (await calendar.json()).data.bookings;
    expect(phoneBooking.customerName).toBe("Phone booking");
    expect(phoneBooking.customerPhone).toBeUndefined();
    const bookingId = phoneBooking.id;
    const noShowUrl = `/api/owner/bookings/${bookingId}/no-show`;
    expect((await mutate(staff.page, noShowUrl, {})).status()).toBe(409);
    await db.query(
      `UPDATE "Booking"
       SET "startAt" = now() - interval '31 minutes', "endAt" = now() - interval '1 minute'
       WHERE id = $1`,
      [bookingId],
    );
    expect((await mutate(staff.page, noShowUrl, {})).status()).toBe(200);
    const noShow = await db.query(
      'SELECT status, "noShowAt" FROM "Booking" WHERE id = $1',
      [bookingId],
    );
    expect(noShow.rows[0]).toMatchObject({
      status: "NO_SHOW",
      noShowAt: expect.any(Date),
    });
    const savedInvite = await db.query(
      'SELECT "tokenHash" FROM "StaffInvitation" WHERE id = $1',
      [invitation.id],
    );
    expect(savedInvite.rows[0].tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(savedInvite.rows[0].tokenHash).not.toBe(new URL(url).hash.slice(1));
  } finally {
    await owner.close();
    await staff.close();
    await db.end();
  }
});

test("customer reads a cancellation quote and the admin exports the refunded reservation", async ({
  browser,
}) => {
  const { db, ids, emails, stageDate } = await fixture();
  const owner = await account(browser, emails.owner, "/owner/dashboard");
  const customer = await account(browser, emails.customer, "/dashboard");
  const admin = await account(browser, emails.admin, "/admin/dashboard");
  try {
    const selection = { pitchId: ids.pitch, slotIds: [ids.slot], addons: [] };
    const quoteResponse = await mutate(
      owner.page,
      "/api/owner/bookings/quote",
      selection,
    );
    expect(quoteResponse.ok()).toBeTruthy();
    const quote = (await quoteResponse.json()).data.quote;
    const creation = await mutate(owner.page, "/api/owner/bookings/manual", {
      ...selection,
      quoteFingerprint: quote.fingerprint,
      source: "PHONE",
      playerCount: 4,
      paymentMethod: "CASH",
      identity: { type: "customer", email: emails.customer },
    });
    expect(creation.status()).toBe(201);
    const booking = (await creation.json()).data.booking;
    await customer.page.goto(`/bookings/${booking.id}`);
    await customer.page
      .getByRole("button", { name: "Cancel reservation" })
      .click();
    await customer.page
      .getByRole("button", { name: "Review cancellation quote" })
      .click();
    await customer.page
      .getByLabel("Cancellation reason")
      .fill("Unable to attend the match");
    await customer.page
      .getByRole("button", { name: "Confirm cancellation" })
      .click();
    await expect(
      customer.page.getByRole("heading", { name: "Refund activity" }),
    ).toBeVisible();
    await admin.page.goto("/admin/refunds");
    await expect(
      admin.page.getByText(booking.bookingNumber, { exact: false }),
    ).toBeVisible();
    const exported = await admin.page.request.get(
      `/api/admin/reports/export?kind=cancellations&venueId=${ids.venue}&from=${stageDate}&to=${stageDate}`,
    );
    expect(exported.headers()["content-type"]).toContain("text/csv");
    expect(await exported.text()).toContain(booking.bookingNumber);
    expect(
      (await customer.page.request.get("/api/admin/reports/export")).status(),
    ).toBe(403);
  } finally {
    await owner.close();
    await customer.close();
    await admin.close();
    await db.end();
  }
});
