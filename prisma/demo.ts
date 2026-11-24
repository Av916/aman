import { getPrisma } from "@/lib/prisma";
import { hashPassword } from "@/modules/auth/crypto";
import { refreshPitch } from "@/modules/availability/service";
import { saveVenue } from "@/modules/favorites/service";
import { lockPitch, lockVenue } from "@/modules/venues/venue.repository";
import { z } from "zod";

const cities = [
  {
    city: "Ludhiana",
    state: "Punjab",
    locality: "Sarabha Nagar",
    latitude: 30.901,
    longitude: 75.857,
    postalCode: "141001",
  },
  {
    city: "Chandigarh",
    state: "Chandigarh",
    locality: "Sector 22",
    latitude: 30.733,
    longitude: 76.779,
    postalCode: "160022",
  },
  {
    city: "Delhi",
    state: "Delhi",
    locality: "Dwarka",
    latitude: 28.59,
    longitude: 77.05,
    postalCode: "110075",
  },
  {
    city: "Bengaluru",
    state: "Karnataka",
    locality: "Whitefield",
    latitude: 12.969,
    longitude: 77.75,
    postalCode: "560066",
  },
];
const locations = [
  {
    name: "Boundary Arena",
    photo: "boundary",
    alt: "Enclosed cricket turf beside urban buildings",
  },
  {
    name: "Willow Pavilion",
    photo: "willow",
    alt: "Open green ground bordered by palm trees",
  },
  {
    name: "Highline Nets",
    photo: "highline",
    alt: "Floodlit cricket ground beside rooftops",
  },
];

export async function seedDemo(rawPassword: unknown) {
  const password = z.string().min(16).max(128).parse(rawPassword);
  const database = getPrisma();
  const passwordHash = await hashPassword(password);
  const amenities = await database.amenity.findMany({
    where: {
      slug: { in: ["floodlights", "parking", "drinking-water", "washrooms"] },
    },
    select: { id: true },
  });
  const createIdentity = (
    email: string,
    name: string,
    role: "CUSTOMER" | "OWNER",
  ) =>
    database.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        name,
        role,
        passwordHash,
        emailVerified: new Date(),
        ...(role === "OWNER"
          ? {
              ownerProfile: {
                create: {
                  businessName: name,
                  businessPhone: "+91 99999 00000",
                  verificationStatus: "APPROVED",
                },
              },
            }
          : {}),
      },
      select: { id: true, role: true },
    });
  try {
    const player = await createIdentity(
      "player@demo.pitchmate.test",
      "Demo Player",
      "CUSTOMER",
    );
    if (player.role !== "CUSTOMER")
      throw new Error("The demo player email is already in use.");
    for (const [cityIndex, address] of cities.entries()) {
      const citySlug = address.city.toLowerCase();
      const owner = await createIdentity(
        `owner-${citySlug}@demo.pitchmate.test`,
        `Demo ${address.city} Cricket`,
        "OWNER",
      );
      if (owner.role !== "OWNER")
        throw new Error("A demo owner email is already in use.");
      for (const [index, location] of locations.entries()) {
        const slug = `demo-${citySlug}-${location.photo}`;
        const visible = index < 2;
        const venue = await database.venue.upsert({
          where: { slug },
          update: {},
          create: {
            ...address,
            latitude: address.latitude + index * 0.012,
            longitude: address.longitude + index * 0.012,
            ownerId: owner.id,
            slug,
            name: `Demo ${address.city} ${location.name}`,
            address: `Illustrative ground near ${address.locality}`,
            description:
              "Fictional PitchMate demonstration venue. Images and hourly rates are sample data.",
            contactPhone: "+91 99999 00000",
            contactEmail: `venue@${citySlug}.example.test`,
            status: visible ? "APPROVED" : "PENDING_APPROVAL",
            publishedAt: visible ? new Date() : null,
            amenities: {
              create: amenities.map((amenity) => ({ amenityId: amenity.id })),
            },
            images: {
              create: [
                {
                  imageUrl: `/images/${location.photo}.webp`,
                  storageKey: `demo:${slug}`,
                  altText: location.alt,
                  sortOrder: 0,
                  isCover: true,
                },
              ],
            },
            pitches: {
              create: [0, 1].map((number) => ({
                name: number ? "Practice nets" : "Main pitch",
                pitchType: number
                  ? "NET_PRACTICE"
                  : index === 1
                    ? "FULL_GROUND"
                    : "BOX_CRICKET",
                surfaceType: index === 1 ? "NATURAL_GRASS" : "ARTIFICIAL_TURF",
                capacity: number ? 6 : index === 1 ? 22 : 12,
                lengthInMeters: number ? 22 : index === 1 ? 85 : 36,
                widthInMeters: number ? 5 : index === 1 ? 70 : 22,
                basePrice: 60_000 + 10_000 * (index + number + cityIndex),
                slotDurationMinutes: number ? 30 : 60,
                minimumBookingMinutes: number ? 30 : 60,
                hours: {
                  create: Array.from({ length: 7 }, (_, dayOfWeek) => ({
                    dayOfWeek,
                    openingTime: 360,
                    closingTime: 1320,
                  })),
                },
                pricingRules: {
                  create: [
                    {
                      name: "Weekend rate",
                      ruleType: "WEEKEND",
                      daysOfWeek: [],
                      pricePerHour: 100_000 + cityIndex * 10_000,
                      priority: 10,
                    },
                    {
                      name: "Evening peak",
                      ruleType: "PEAK_HOUR",
                      daysOfWeek: [],
                      startTime: 1080,
                      endTime: 1260,
                      pricePerHour: 130_000 + cityIndex * 10_000,
                      priority: 20,
                    },
                  ],
                },
              })),
            },
          },
          select: {
            id: true,
            ownerId: true,
            status: true,
            publishedAt: true,
            pitches: { select: { id: true } },
          },
        });
        if (venue.ownerId !== owner.id)
          throw new Error("A demo slug is owned by another account.");
        for (const pitch of venue.pitches)
          await database.$transaction(
            async (tx) => {
              const lockedVenue = await lockVenue(tx, venue.id, owner.id);
              await refreshPitch(
                tx,
                await lockPitch(tx, pitch.id),
                lockedVenue,
                false,
              );
            },
            { timeout: 20_000 },
          );
        if (index === 0 && venue.status === "APPROVED" && venue.publishedAt)
          await saveVenue(player.id, venue.id);
      }
    }
    console.info("Demo venues, pitches and favorites are ready.");
  } finally {
    await database.$disconnect();
  }
}
