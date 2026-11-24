import { z } from "zod";

export const email = z.string().trim().toLowerCase().pipe(z.email().max(254));
export const name = z
  .string()
  .trim()
  .min(2, "Enter at least 2 characters.")
  .max(80)
  .regex(/^[^\p{Cc}\p{Cf}]+$/u, "Remove control characters.");
export const phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9 ()-]{7,20}$/, "Enter a valid phone number.")
  .refine((number) => {
    const digits = number.replace(/\D/g, "").length;
    return digits >= 7 && digits <= 15;
  }, "Enter a valid phone number.");
export const password = z
  .string()
  .min(12, "Use at least 12 characters.")
  .max(128);
const existingPassword = z.string().min(1, "Enter your password.").max(128);
const token = z
  .string()
  .regex(/^[a-f0-9]{64}$/, "Open the complete link from your email.");

export const customerRegistration = z.strictObject({ name, email, password });
export const ownerRegistration = customerRegistration.extend({
  businessName: name,
  businessPhone: phone,
});
export const loginSchema = z.strictObject({
  email,
  password: existingPassword,
});
export const forgotSchema = z.strictObject({ email });
export const resetSchema = z.strictObject({ token, password });
export const verificationSchema = z.strictObject({
  token,
  password: existingPassword,
});
export const resendSchema = loginSchema;
export const changePasswordSchema = z
  .strictObject({
    currentPassword: existingPassword,
    password,
  })
  .refine(({ currentPassword, password }) => currentPassword !== password, {
    path: ["password"],
    message: "Choose a different password.",
  });
