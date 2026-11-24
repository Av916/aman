import { z } from "zod";
import { PricingRuleType } from "@/generated/prisma/enums";
import { minute, weekday } from "@/modules/schedules/validation";
import { civilDate } from "@/modules/schedules/time";

export const paise = z.number().int().min(0).max(10_000_000);
export const pricingInput = z
  .strictObject({
    name: z.string().trim().min(2).max(70),
    ruleType: z.enum(PricingRuleType),
    daysOfWeek: z.array(weekday).max(7).default([]),
    startTime: minute.nullable().default(null),
    endTime: z.number().int().min(0).max(1440).nullable().default(null),
    pricePerHour: paise,
    effectiveFrom: z.iso.date().nullable().default(null),
    effectiveUntil: z.iso.date().nullable().default(null),
    priority: z.number().int().min(-1000).max(1000).default(0),
    isActive: z.boolean().default(true),
  })
  .superRefine((rule, ctx) => {
    const {
      startTime,
      endTime,
      effectiveFrom,
      effectiveUntil,
      daysOfWeek,
      ruleType,
    } = rule;
    if (
      (startTime === null) !== (endTime === null) ||
      (startTime !== null && startTime === endTime)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["endTime"],
        message: "Supply two distinct times or leave both blank.",
      });
    }
    if (effectiveFrom && effectiveUntil && effectiveFrom > effectiveUntil) {
      ctx.addIssue({
        code: "custom",
        path: ["effectiveUntil"],
        message: "End date must be on or after start date.",
      });
    }
    if (
      (ruleType === "HOLIDAY" || ruleType === "SPECIAL_EVENT") &&
      (!effectiveFrom || !effectiveUntil)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["effectiveFrom"],
        message: "Special-date rules require both dates.",
      });
    }
    if (
      new Set(daysOfWeek).size !== daysOfWeek.length ||
      (ruleType === "WEEKDAY" &&
        daysOfWeek.some((day) => day === 0 || day === 6)) ||
      (ruleType === "WEEKEND" && daysOfWeek.some((day) => day > 0 && day < 6))
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["daysOfWeek"],
        message: "Choose distinct days consistent with the rule type.",
      });
    }
  });

export function pricingData(data: z.output<typeof pricingInput>) {
  return {
    ...data,
    effectiveFrom: data.effectiveFrom ? civilDate(data.effectiveFrom) : null,
    effectiveUntil: data.effectiveUntil ? civilDate(data.effectiveUntil) : null,
  };
}
