import { endpoint, readBody, success } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { limitAttempt } from "@/modules/auth/rate-limit";
import { changePasswordSchema } from "@/modules/auth/schemas";
import { changePassword } from "@/modules/auth/service";

export const PATCH = endpoint(async (request) => {
  const data = await readBody(request, changePasswordSchema);
  const user = await requireUser();
  await limitAttempt("change-password", request.headers, user.id);
  await changePassword(user, data);
  return success("Password changed. Sign in again to continue.");
});
