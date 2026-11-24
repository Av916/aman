import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import {
  calculatePrice,
  validateSlotSequence,
} from "@/modules/pricing/pricing.calculator";
import {
  assertTransition,
  holdExpired,
} from "@/modules/bookings/booking.state-machine";
import { validJobToken, verifySignature } from "@/modules/payments/signatures";
import { createBookingInput } from "@/modules/bookings/booking.validation";

const addon = (
  pricingType: "PER_BOOKING" | "PER_HOUR" | "PER_QUANTITY",
  price: number,
  quantity: number,
) => ({ id: pricingType, name: pricingType, pricingType, price, quantity });
const start = +new Date("2026-11-25T10:00:00Z");
const slot = (offset: number) => ({
  startAt: new Date(start + offset * 60_000),
  endAt: new Date(start + (offset + 30) * 60_000),
});
const pitch = {
  slotDurationMinutes: 30,
  minimumBookingMinutes: 60,
  maximumBookingMinutes: 90,
};

describe("booking arithmetic and validation", () => {
  it("prices mixed slots and each add-on model using rounded integer paise", () => {
    const result = calculatePrice(
      [100001, 120002],
      90,
      [
        addon("PER_BOOKING", 5000, 1),
        addon("PER_HOUR", 10001, 1),
        addon("PER_QUANTITY", 1000, 3),
      ],
      5000,
      1800,
    );
    expect(result).toMatchObject({
      subtotal: 220003,
      addonTotal: 23002,
      platformFee: 5000,
      discountAmount: 0,
      taxAmount: 44641,
      totalAmount: 292646,
    });
    expect(result.addons.map((item) => item.totalPrice)).toEqual([
      5000, 15002, 3000,
    ]);
  });
  it("rejects quantity on per-hour items and nonrepresentable total prices", () => {
    expect(() =>
      calculatePrice([0], 60, [addon("PER_HOUR", 1, 2)], 0, 0),
    ).toThrow();
    expect(() => calculatePrice([2147483647], 60, [], 1, 0)).toThrow();
    expect(() => calculatePrice([-1], 60, [], 0, 0)).toThrow();
  });
  it("accepts contiguous intervals and rejects gaps and invalid booking bounds", () => {
    expect(validateSlotSequence([slot(0), slot(30)], pitch)).toBe(60);
    expect(() => validateSlotSequence([slot(0), slot(60)], pitch)).toThrow();
    expect(() => validateSlotSequence([slot(0)], pitch)).toThrow();
    expect(() =>
      validateSlotSequence([slot(0), slot(30), slot(60), slot(90)], pitch),
    ).toThrow();
  });
  it("rejects client-supplied total amounts and defines terminal outcomes", () => {
    expect(createBookingInput.safeParse({ totalAmount: 1 }).success).toBe(
      false,
    );
    expect(() => assertTransition("EXPIRED", "CONFIRMED")).toThrow();
    expect(() => assertTransition("CONFIRMED", "CANCELLED")).not.toThrow();
    expect(() => assertTransition("CHECKED_IN", "CANCELLED")).toThrow();
    expect(() =>
      assertTransition("PENDING_PAYMENT", "CONFIRMED"),
    ).not.toThrow();
    expect(holdExpired(new Date(start), new Date(start))).toBe(true);
  });
  it("checks raw webhook bytes and checkout signatures without accepting modified input", () => {
    const secret = "test-signing-secret";
    const hmac = (value: string) =>
      createHmac("sha256", secret).update(value).digest("hex");
    const body = '{"event":"payment.captured"}';
    const pair = "order_test|pay_test";
    expect(verifySignature(body, hmac(body), secret)).toBe(true);
    expect(verifySignature(body + "\n", hmac(body), secret)).toBe(false);
    expect(verifySignature(pair, hmac(pair), secret)).toBe(true);
    expect(verifySignature("order_other|pay_test", hmac(pair), secret)).toBe(
      false,
    );
    expect(verifySignature(body, "invalid", secret)).toBe(false);
    expect(validJobToken("Bearer demo-secret", "demo-secret")).toBe(true);
    expect(validJobToken("Bearer demo-secret", undefined)).toBe(false);
  });
});
