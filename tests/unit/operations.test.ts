import { describe, expect, it } from "vitest";
import { defaultPolicy, refundQuote } from "@/modules/cancellations/policy";
import { couponDiscount } from "@/modules/coupons/service";
import { csvCell } from "@/modules/finance/reports";
import { occupancyRate } from "@/modules/finance/analytics";
import { rolesWith } from "@/modules/permissions/operations";

describe("operational rules", () => {
  const now = new Date("2026-12-01T00:00:00Z");
  const booking = (hours: number) => ({
    startAt: new Date(+now + hours * 3_600_000),
    cancellationPolicySnapshot: defaultPolicy,
  });

  it("applies the immutable threshold at the exact boundary and reserves remaining captured funds", () => {
    expect(refundQuote(booking(24), 200000, 0, now, false).refundAmount).toBe(
      200000,
    );
    expect(refundQuote(booking(15), 200000, 0, now, false).refundAmount).toBe(
      100000,
    );
    expect(
      refundQuote(booking(12), 200001, 50000, now, false).refundAmount,
    ).toBe(50000);
    expect(refundQuote(booking(3), 200000, 0, now, false).refundAmount).toBe(0);
    expect(refundQuote(booking(3), 200000, 0, now, true).refundAmount).toBe(
      200000,
    );
  });

  it("rounds and caps discounts within the sellable component", () => {
    expect(
      couponDiscount(
        { discountType: "PERCENTAGE", discountValue: 25, maximumDiscount: 10 },
        200,
      ),
    ).toBe(10);
    expect(
      couponDiscount(
        { discountType: "FIXED", discountValue: 300, maximumDiscount: null },
        40,
      ),
    ).toBe(40);
    expect(
      couponDiscount(
        {
          discountType: "PERCENTAGE",
          discountValue: 25,
          maximumDiscount: null,
        },
        101,
      ),
    ).toBe(25);
  });

  it("handles empty inventory and avoids rounding occupancy to a whole percentage", () => {
    expect(occupancyRate(0, 0)).toBe(0);
    expect(occupancyRate(60, 180)).toBe(33.33);
  });

  it("neutralizes spreadsheet formulas and quotes CSV values", () => {
    expect(csvCell(" =1+1")).toBe('"\' =1+1"');
    expect(csvCell("\t=1")).toBe('"\'\t=1"');
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
    expect(csvCell(-500)).toBe('"-500"');
  });

  it("keeps refunds, attendance, and reception actions scoped by role", () => {
    expect(rolesWith("refund")).toEqual(["ACCOUNTANT"]);
    expect(rolesWith("reserve")).toEqual(["MANAGER", "RECEPTIONIST"]);
    expect(rolesWith("attend")).not.toContain("ACCOUNTANT");
    expect(rolesWith("staff")).toEqual([]);
  });
});
