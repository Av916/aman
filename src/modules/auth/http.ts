import { endpoint, readBody, success } from "@/lib/api";
import { tokenDigest } from "./crypto";
import { deliverAfterResponse } from "./email";
import { limitAttempt } from "./rate-limit";
import {
  customerRegistration,
  forgotSchema,
  ownerRegistration,
  resendSchema,
  resetSchema,
  verificationSchema,
} from "./schemas";
import {
  registerCustomer,
  registerOwner,
  requestPasswordReset,
  resendVerification,
  resetPassword,
  verifyEmail,
} from "./service";

export const registerCustomerPost = endpoint(async (request) => {
  const data = await readBody(request, customerRegistration);
  await limitAttempt("registration", request.headers, data.email);
  const result = await registerCustomer(data);
  deliverAfterResponse(result.email);
  return success(
    "Account created. Check your email to verify it.",
    { user: result.user },
    201,
  );
});

export const registerOwnerPost = endpoint(async (request) => {
  const data = await readBody(request, ownerRegistration);
  await limitAttempt("registration", request.headers, data.email);
  const result = await registerOwner(data);
  deliverAfterResponse(result.email);
  return success(
    "Owner account created. Check your email to verify it.",
    { user: result.user },
    201,
  );
});

export const forgotPasswordPost = endpoint(async (request) => {
  const { email } = await readBody(request, forgotSchema);
  await limitAttempt("forgot-password", request.headers, email);
  deliverAfterResponse(await requestPasswordReset(email));
  return success(
    "If the account can reset its password, you’ll receive a reset link.",
  );
});

export const resetPasswordPost = endpoint(async (request) => {
  const { token, password } = await readBody(request, resetSchema);
  await limitAttempt("reset-password", request.headers, tokenDigest(token));
  await resetPassword(token, password);
  return success("Password reset. Sign in with your new password.");
});

export const verifyEmailPost = endpoint(async (request) => {
  const { token, password } = await readBody(request, verificationSchema);
  await limitAttempt("verify-email", request.headers, tokenDigest(token));
  await verifyEmail(token, password);
  return success("Email verified. You can now sign in.");
});

export const resendVerificationPost = endpoint(async (request) => {
  const { email, password } = await readBody(request, resendSchema);
  await limitAttempt("resend-verification", request.headers, email);
  deliverAfterResponse(await resendVerification(email, password));
  return success(
    "If the account still needs verification, you’ll receive a new link.",
  );
});
