import { z } from "zod";
import { name, phone } from "@/modules/auth/schemas";

export const updateProfileSchema = z
  .strictObject({
    name: name.optional(),
    phone: z
      .union([phone, z.literal("")])
      .nullable()
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Supply at least one profile field.",
  });
