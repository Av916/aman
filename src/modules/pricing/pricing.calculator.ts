import { AppError } from "@/lib/api";
import type { AddonPricingType } from "@/generated/prisma/enums";

type AddonInput = {
  name: string;
  id: string;
  price: number;
  pricingType: AddonPricingType;
  quantity: number;
};
const maxPaise = 2_147_483_647;
function bounded(value: bigint) {
  if (value < BigInt(0) || value > BigInt(maxPaise))
    throw new AppError(
      422,
      "PRICE_OUT_OF_RANGE",
      "The booking price is out of range.",
    );
  return Number(value);
}

export function calculatePrice(
  slotPrices: number[],
  duration: number,
  addons: AddonInput[],
  platformFee: number,
  taxRate: number,
  discountAmount = 0,
) {
  const subtotal = bounded(
    slotPrices.reduce((sum, price) => sum + BigInt(price), BigInt(0)),
  );
  const addonLines = addons.map((addon) => {
    if (addon.pricingType !== "PER_QUANTITY" && addon.quantity !== 1)
      throw new AppError(
        422,
        "ADDON_QUANTITY",
        "Only per-item add-ons accept multiple units.",
      );
    const totalPrice = bounded(
      addon.pricingType === "PER_HOUR"
        ? (BigInt(addon.price) * BigInt(duration) + BigInt(30)) / BigInt(60)
        : BigInt(addon.price) * BigInt(addon.quantity),
    );
    return {
      addonId: addon.id,
      nameSnapshot: addon.name,
      unitPrice: addon.price,
      quantity: addon.quantity,
      pricingType: addon.pricingType,
      totalPrice,
    };
  });
  const addonTotal = bounded(
    addonLines.reduce((sum, item) => sum + BigInt(item.totalPrice), BigInt(0)),
  );
  const taxed =
    BigInt(subtotal) +
    BigInt(addonTotal) +
    BigInt(platformFee) -
    BigInt(discountAmount);
  const taxAmount = bounded(
    (taxed * BigInt(taxRate) + BigInt(5000)) / BigInt(10000),
  );
  return {
    subtotal,
    addonTotal,
    discountAmount,
    platformFee,
    taxAmount,
    totalAmount: bounded(taxed + BigInt(taxAmount)),
    addons: addonLines,
  };
}

export function validateSlotSequence(
  slots: { startAt: Date; endAt: Date }[],
  pitch: {
    slotDurationMinutes: number;
    minimumBookingMinutes: number;
    maximumBookingMinutes: number;
  },
) {
  const duration = slots.length * pitch.slotDurationMinutes;
  if (
    !slots.length ||
    slots.some(
      (slot, i) =>
        +slot.endAt - +slot.startAt !== pitch.slotDurationMinutes * 60_000 ||
        (i > 0 && +slot.startAt !== +slots[i - 1].endAt),
    )
  ) {
    throw new AppError(
      422,
      "NON_CONSECUTIVE_SLOTS",
      "Choose consecutive slots on the same pitch.",
    );
  }
  if (
    duration < pitch.minimumBookingMinutes ||
    duration > pitch.maximumBookingMinutes
  )
    throw new AppError(
      422,
      "BOOKING_DURATION",
      `Choose between ${pitch.minimumBookingMinutes} and ${pitch.maximumBookingMinutes} minutes.`,
    );
  return duration;
}
