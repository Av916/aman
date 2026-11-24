import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { generateSlots } from "@/modules/availability/generate";
import { optimizeImage } from "@/modules/media/validation";
import {
  ambiguousRules,
  priceForMinutes,
  priceResolver,
} from "@/modules/pricing/resolve";
import { pricingData, pricingInput } from "@/modules/pricing/validation";
import { atVenueTime, civilDate } from "@/modules/schedules/time";
import { weeklySchedule } from "@/modules/schedules/validation";
import { turfReturnPath } from "@/config/return-path";

const interval = (
  dayOfWeek: number,
  openingTime: number,
  closingTime: number,
) => ({ dayOfWeek, openingTime, closingTime, isClosed: false });
const pitch = { isActive: true, basePrice: 80_000, slotDurationMinutes: 60 };

describe("venue-local slots", () => {
  it("rejects weekly overlaps across midnight and the Sunday boundary", () => {
    expect(
      weeklySchedule.safeParse({
        hours: [interval(6, 1320, 120), interval(0, 60, 240)],
      }).success,
    ).toBe(false);
    expect(
      weeklySchedule.safeParse({
        hours: [interval(6, 1320, 120), interval(0, 120, 240)],
      }).success,
    ).toBe(true);
  });

  it("produces UTC slots for an overnight schedule with the original local grid", () => {
    const slots = generateSlots({
      pitch,
      hours: [interval(6, 1320, 120)],
      exceptions: [],
      rules: [],
      timezone: "Asia/Kolkata",
      startDay: "2026-11-07",
      days: 2,
      now: civilDate("2026-11-07"),
      currency: "INR",
    });
    expect(slots.map((slot) => slot.startAt.toISOString())).toEqual([
      "2026-11-07T16:30:00.000Z",
      "2026-11-07T17:30:00.000Z",
      "2026-11-07T18:30:00.000Z",
      "2026-11-07T19:30:00.000Z",
    ]);
  });

  it("lets a closed exception override the entire local date, including overnight spill", () => {
    const common = {
      pitch,
      hours: [interval(6, 1320, 120), interval(0, 360, 540)],
      rules: [],
      timezone: "Asia/Kolkata",
      startDay: "2026-11-07",
      days: 2,
      now: civilDate("2026-11-07"),
      currency: "INR",
    };
    const slots = generateSlots({
      ...common,
      exceptions: [
        {
          date: civilDate("2026-11-08"),
          openingTime: null,
          closingTime: null,
          isClosed: true,
        },
      ],
    });
    expect(slots).toHaveLength(2);
    const special = generateSlots({
      ...common,
      exceptions: [
        {
          date: civilDate("2026-11-08"),
          openingTime: 900,
          closingTime: 960,
          isClosed: false,
        },
      ],
    });
    expect(special).toHaveLength(3);
    expect(special[2].startAt.toISOString()).toBe("2026-11-08T09:30:00.000Z");
  });

  it("uses elapsed slot length across daylight-saving transitions", () => {
    const slots = generateSlots({
      pitch,
      hours: [interval(0, 60, 240)],
      exceptions: [],
      rules: [],
      timezone: "America/New_York",
      startDay: "2026-03-08",
      days: 1,
      now: civilDate("2026-03-08"),
      currency: "INR",
    });
    expect(slots).toHaveLength(2);
    expect(slots[0].startAt.toISOString()).toBe("2026-03-08T06:00:00.000Z");
    expect(slots[1].endAt.toISOString()).toBe("2026-03-08T08:00:00.000Z");
    expect(atVenueTime("2026-11-01", 0, "America/New_York").toISOString()).toBe(
      "2026-11-01T04:00:00.000Z",
    );
    expect(
      atVenueTime("2026-11-01", 1440, "America/New_York").toISOString(),
    ).toBe("2026-11-02T05:00:00.000Z");
  });
});

describe("pricing", () => {
  const rule = (fields: Record<string, unknown>) =>
    pricingData(
      pricingInput.parse({
        name: "Example rate",
        pricePerHour: 100_000,
        ...fields,
      }),
    );
  it("resolves weekend, evening peak and a dated override by priority", () => {
    const weekend = rule({ ruleType: "WEEKEND", priority: 5 });
    const peak = rule({
      ruleType: "PEAK_HOUR",
      startTime: 1080,
      endTime: 1260,
      priority: 10,
      pricePerHour: 120_000,
    });
    const special = rule({
      ruleType: "HOLIDAY",
      effectiveFrom: "2026-11-07",
      effectiveUntil: "2026-11-07",
      priority: 15,
      pricePerHour: 140_000,
    });
    const resolve = priceResolver(80_000, [weekend, special, peak]);
    expect(resolve("2026-11-06", 360)).toBe(80_000);
    expect(resolve("2026-11-08", 360)).toBe(100_000);
    expect(resolve("2026-11-08", 1080)).toBe(120_000);
    expect(resolve("2026-11-07", 1080)).toBe(140_000);
    expect(priceForMinutes(80_000, 30)).toBe(40_000);
    expect(priceForMinutes(80_001, 30)).toBe(40_001);
  });

  it("detects equal priority overnight overlap and allows adjacent or disjoint date ranges", () => {
    const late = rule({
      ruleType: "PEAK_HOUR",
      daysOfWeek: [6],
      startTime: 1320,
      endTime: 90,
      priority: 5,
    });
    const early = rule({
      ruleType: "PEAK_HOUR",
      daysOfWeek: [0],
      startTime: 60,
      endTime: 120,
      priority: 5,
    });
    expect(ambiguousRules(late, early)).toBe(true);
    expect(ambiguousRules(late, { ...early, startTime: 90 })).toBe(false);
    expect(ambiguousRules(late, { ...early, priority: 6 })).toBe(false);
    expect(
      ambiguousRules(
        {
          ...late,
          effectiveFrom: civilDate("2026-11-07"),
          effectiveUntil: civilDate("2026-11-07"),
        },
        {
          ...early,
          effectiveFrom: civilDate("2026-11-15"),
          effectiveUntil: civilDate("2026-11-15"),
        },
      ),
    ).toBe(false);
  });
});

describe("media and navigation", () => {
  it("rejects forged images, oversized images and unexpected formats", async () => {
    await expect(
      optimizeImage(
        new File(["this is not a photo"], "ground.png", { type: "image/png" }),
      ),
    ).rejects.toMatchObject({ code: "INVALID_IMAGE" });
    await expect(
      optimizeImage(
        new File([new Uint8Array(5 * 1024 * 1024 + 1)], "ground.webp", {
          type: "image/webp",
        }),
      ),
    ).rejects.toMatchObject({ code: "IMAGE_SIZE" });
    const png = await sharp({
      create: { width: 16, height: 16, channels: 3, background: "#16845b" },
    })
      .png()
      .toBuffer();
    const result = await optimizeImage(
      new File([new Uint8Array(png)], "ground.png", { type: "image/png" }),
    );
    expect((await sharp(result).metadata()).format).toBe("webp");
  });
  it("only accepts public turf destinations for authentication returns", () => {
    expect(turfReturnPath("/turfs/boundary?date=2026-11-25")).toBe(
      "/turfs/boundary?date=2026-11-25",
    );
    expect(turfReturnPath("//external.example/turfs")).toBeUndefined();
    expect(turfReturnPath("/turfs/../admin")).toBeUndefined();
    expect(turfReturnPath("/owner/venues")).toBeUndefined();
  });
});
