import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { getPrisma } from "@/lib/prisma";
import {
  createVenue,
  editVenue,
  ownerAction,
  getOwnerVenue,
} from "@/modules/venues/venue.service";
import { moderateVenue, venueReview } from "@/modules/admin/venue-review";
import { discoverVenues, publicVenue } from "@/modules/venues/venue.repository";
import { discoveryQuery, venueCreate } from "@/modules/venues/venue.validation";
import {
  addPitch,
  setWeeklySchedule,
  generateOwnerSlots,
  maintainSlots,
  writePricing,
  addException,
  editPitch,
} from "@/modules/pitches/service";
import { pitchAvailability } from "@/modules/availability/service";
import {
  listFavorites,
  saveVenue,
  unsaveVenue,
} from "@/modules/favorites/service";
import {
  civilDate,
  dayOfWeek,
  localDay,
  shiftDay,
} from "@/modules/schedules/time";
import { pricingInput } from "@/modules/pricing/validation";

const databaseUrl = process.env.TEST_DATABASE_URL;
const key = `venue-${randomUUID().slice(0, 8)}`;
const zone = "Asia/Kolkata";
const tomorrow = shiftDay(localDay(new Date(), zone), 1);
const hours = [
  {
    dayOfWeek: dayOfWeek(tomorrow),
    openingTime: 360,
    closingTime: 600,
    isClosed: false,
  },
];
const location = {
  description: "Fictional pitch for integration coverage.",
  city: "Ludhiana",
  state: "Punjab",
  country: "India",
  address: "123 Integration Street",
  locality: "Test Nagar",
  postalCode: "141001",
  latitude: 31.1,
  longitude: 76.1,
  contactPhone: "+91 98765 43210",
  contactEmail: "venue@example.test",
};
const pitchData = {
  name: "Main ground",
  pitchType: "BOX_CRICKET",
  surfaceType: "ARTIFICIAL_TURF",
  lengthInMeters: 30,
  widthInMeters: 20,
  capacity: 12,
  basePrice: 80_000,
  slotDurationMinutes: 30,
} as const;

describe.skipIf(!databaseUrl)("Phase 2 persistence and review", () => {
  let ownerId: string;
  let otherOwnerId: string;
  let adminId: string;
  let playerId: string;

  beforeAll(async () => {
    if (!databaseUrl || databaseUrl === process.env.DATABASE_URL)
      throw new Error("Use a separate isolated test database.");
    process.env.DATABASE_URL = databaseUrl;
    const database = getPrisma();
    const create = (label: string, role: "OWNER" | "ADMIN" | "CUSTOMER") =>
      database.user.create({
        data: {
          name: label,
          email: `${key}-${label}@example.test`,
          role,
          emailVerified: new Date(),
          ...(role === "OWNER"
            ? {
                ownerProfile: {
                  create: {
                    businessName: label + " Cricket",
                    businessPhone: "+91 98765 43210",
                    verificationStatus: "APPROVED",
                  },
                },
              }
            : {}),
        },
      });
    const [owner, other, admin, player] = await Promise.all([
      create("owner", "OWNER"),
      create("other", "OWNER"),
      create("admin", "ADMIN"),
      create("player", "CUSTOMER"),
    ]);
    ownerId = owner.id;
    otherOwnerId = other.id;
    adminId = admin.id;
    playerId = player.id;
  });
  afterAll(() => getPrisma().$disconnect());

  async function completeDraft(name: string) {
    const venue = await createVenue(
      ownerId,
      venueCreate.parse({ name, ...location }),
    );
    const pitch = await addPitch(ownerId, venue.id, pitchData);
    await setWeeklySchedule(ownerId, pitch.id, { hours });
    await getPrisma().venueImage.create({
      data: {
        venueId: venue.id,
        storageKey: `fixture:${venue.id}`,
        imageUrl: "/images/boundary.webp",
        altText: "Test cricket ground",
        isCover: true,
        sortOrder: 0,
      },
    });
    return { venue, pitch };
  }

  it("enforces ownership, moderation, explicit publishing, favorites and reapproval", async () => {
    const { venue, pitch } = await completeDraft(`${key} Cricket Arena`);
    await expect(getOwnerVenue(otherOwnerId, venue.id)).rejects.toMatchObject({
      status: 404,
    });
    await expect(
      editVenue(otherOwnerId, venue.id, { name: "Renamed" }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      editPitch(otherOwnerId, pitch.id, { capacity: 10 }),
    ).rejects.toMatchObject({ status: 404 });
    expect(await publicVenue(venue.slug)).toBeNull();
    await expect(
      ownerAction(ownerId, venue.id, "publish"),
    ).rejects.toMatchObject({ status: 409 });
    await ownerAction(ownerId, venue.id, "submit");
    await moderateVenue(
      adminId,
      venue.id,
      "reject",
      "Please clarify the address.",
    );
    await expect(
      moderateVenue(adminId, venue.id, "approve"),
    ).rejects.toMatchObject({ code: "INVALID_VENUE_TRANSITION" });
    await editVenue(ownerId, venue.id, { address: "Corrected address" });
    await ownerAction(ownerId, venue.id, "submit");
    await moderateVenue(adminId, venue.id, "approve");
    expect(await publicVenue(venue.slug)).toBeNull();
    await ownerAction(ownerId, venue.id, "publish");
    expect(await publicVenue(venue.slug)).toMatchObject({
      address: "Corrected address",
    });
    const publicData = await publicVenue(venue.slug);
    expect(publicData).not.toHaveProperty("ownerId");
    expect(publicData?.images[0]).not.toHaveProperty("storageKey");
    const slots = (await pitchAvailability(pitch.id, tomorrow)).slots;
    expect(slots).toHaveLength(8);
    expect(slots[0].price).toBe(40_000);
    await saveVenue(playerId, venue.id);
    await saveVenue(playerId, venue.id);
    expect(
      (await listFavorites(playerId)).venues.map((row) => row.id),
    ).toContain(venue.id);
    await unsaveVenue(playerId, venue.id);
    expect(
      (await listFavorites(playerId)).venues.map((row) => row.id),
    ).not.toContain(venue.id);
    await moderateVenue(adminId, venue.id, "suspend");
    expect(await publicVenue(venue.slug)).toBeNull();
    await moderateVenue(adminId, venue.id, "restore");
    expect(await publicVenue(venue.slug)).toBeNull();
    await ownerAction(ownerId, venue.id, "publish");
    await editVenue(ownerId, venue.id, { name: "Updated Cricket Arena" });
    expect(await publicVenue(venue.slug)).toBeNull();
    expect(
      (await venueReview(venue.id)).audit.map((item) => item.action),
    ).toEqual(
      expect.arrayContaining([
        "VENUE_APPROVED",
        "VENUE_REJECTED",
        "VENUE_PUBLISHED",
        "VENUE_SUSPENDED",
        "VENUE_RESTORED",
      ]),
    );
    await ownerAction(ownerId, venue.id, "archive");
    expect((await getOwnerVenue(ownerId, venue.id)).status).toBe("ARCHIVED");
  });

  it("keeps schedule changes atomic and protects intervals under concurrent generation", async () => {
    const { pitch } = await completeDraft(`${key} Protection Test`);
    const database = getPrisma();
    await database.slot.deleteMany({ where: { pitchId: pitch.id } });
    const results = await Promise.all(
      Array.from({ length: 4 }, () => generateOwnerSlots(ownerId, pitch.id)),
    );
    expect(results.filter((result) => result.generated > 0)).toHaveLength(1);
    const start = new Date(civilDate(tomorrow).getTime() + 30 * 60_000);
    const rows = await database.slot.findMany({
      where: {
        pitchId: pitch.id,
        startAt: { gte: start, lt: new Date(+start + 4 * 60 * 60_000) },
      },
      orderBy: { startAt: "asc" },
    });
    expect(rows).toHaveLength(8);
    const [reserved, maintenance] = rows;
    await database.slot.update({
      where: { id: reserved.id },
      data: { status: "BOOKED" },
    });
    const row = {
      pitchId: pitch.id,
      startAt: reserved.startAt,
      endAt: reserved.endAt,
      hourlyPrice: 80_000,
      price: 40_000,
    };
    await expect(database.slot.create({ data: row })).rejects.toBeTruthy();
    await expect(
      database.slot.create({
        data: { ...row, startAt: new Date(+row.startAt + 10 * 60_000) },
      }),
    ).rejects.toBeTruthy();
    await expect(
      maintainSlots(ownerId, pitch.id, [reserved.id], true),
    ).rejects.toMatchObject({ code: "PROTECTED_SLOTS" });
    await maintainSlots(ownerId, pitch.id, [maintenance.id], true);
    const rule = pricingInput.parse({
      name: "Early peak",
      ruleType: "PEAK_HOUR",
      startTime: 360,
      endTime: 480,
      pricePerHour: 125_000,
      priority: 20,
    });
    await writePricing(ownerId, pitch.id, rule);
    await expect(
      writePricing(ownerId, pitch.id, { ...rule, name: "Conflicting price" }),
    ).rejects.toMatchObject({ code: "AMBIGUOUS_PRICING" });
    expect(
      (await database.slot.findUniqueOrThrow({ where: { id: reserved.id } }))
        .price,
    ).toBe(40_000);
    expect(
      (await database.slot.findUniqueOrThrow({ where: { id: maintenance.id } }))
        .status,
    ).toBe("BLOCKED");
    await expect(
      addException(ownerId, pitch.id, {
        date: tomorrow,
        isClosed: true,
        openingTime: null,
        closingTime: null,
        reason: "Ground work",
      }),
    ).rejects.toMatchObject({ code: "PROTECTED_SLOTS" });
    expect(
      await database.scheduleException.count({ where: { pitchId: pitch.id } }),
    ).toBe(0);
    await maintainSlots(ownerId, pitch.id, [maintenance.id], false);
    expect(
      await database.slot.findUnique({
        where: {
          pitchId_startAt: { pitchId: pitch.id, startAt: maintenance.startAt },
        },
      }),
    ).toMatchObject({ status: "AVAILABLE", price: 62_500 });
  });

  it("paginates searchable published results and filters price on the eligible pitch and slot", async () => {
    const { venue, pitch } = await completeDraft(`${key} Filter Ground`);
    const amenity = await getPrisma().amenity.findUniqueOrThrow({
      where: { slug: "floodlights" },
    });
    await editVenue(ownerId, venue.id, { amenityIds: [amenity.id] });
    await addPitch(ownerId, venue.id, {
      ...pitchData,
      name: "Inactive nets",
      pitchType: "NET_PRACTICE",
      basePrice: 10_000,
      isActive: false,
    });
    await writePricing(
      ownerId,
      pitch.id,
      pricingInput.parse({
        name: "Afternoon event",
        ruleType: "PEAK_HOUR",
        startTime: 360,
        endTime: 600,
        pricePerHour: 120_000,
        priority: 10,
      }),
    );
    await ownerAction(ownerId, venue.id, "submit");
    await moderateVenue(adminId, venue.id, "approve");
    await ownerAction(ownerId, venue.id, "publish");
    const filters = {
      q: `${key} Filter`,
      city: "Ludhiana",
      date: tomorrow,
      from: "06:30",
      until: "09:00",
      amenities: "floodlights",
      pitchType: "BOX_CRICKET",
    };
    expect(
      (
        await discoverVenues(
          discoveryQuery.parse({ ...filters, maxPrice: 100_000 }),
        )
      ).venues,
    ).toHaveLength(0);
    expect(
      (
        await discoverVenues(
          discoveryQuery.parse({
            ...filters,
            maxPrice: 130_000,
            sort: "distance",
            lat: 31,
            lng: 76,
          }),
        )
      ).venues[0],
    ).toMatchObject({
      id: venue.id,
      startingPrice: 120_000,
      pitchType: "BOX_CRICKET",
    });

    const tag = `pagination${key.replaceAll("-", "")}`;
    for (let index = 0; index < 13; index++) {
      await getPrisma().venue.create({
        data: {
          ownerId,
          name: `${tag} Ground ${String(index).padStart(2, "0")}`,
          slug: `${tag}-${index}`,
          ...location,
          status: "APPROVED",
          publishedAt: new Date(),
          pitches: {
            create: [{ ...pitchData, basePrice: 80_000 + index * 1000 }],
          },
        },
      });
    }
    const first = await discoverVenues(
      discoveryQuery.parse({ q: tag, sort: "price-asc" }),
    );
    const second = await discoverVenues(
      discoveryQuery.parse({ q: tag, sort: "price-asc", page: 2 }),
    );
    expect(first.pagination).toMatchObject({ total: 13, pages: 2 });
    expect(first.venues).toHaveLength(12);
    expect(second.venues).toHaveLength(1);
    expect(second.venues[0].startingPrice).toBe(92_000);
  });
});
