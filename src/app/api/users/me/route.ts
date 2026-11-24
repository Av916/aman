import { AppError, endpoint, readBody, success } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { findProfile } from "@/modules/users/repository";
import { updateProfileSchema } from "@/modules/users/schemas";
import { updateProfile } from "@/modules/users/service";

export const GET = endpoint(async () => {
  const user = await requireUser();
  const profile = await findProfile(user.id);
  if (!profile || profile.status !== "ACTIVE")
    throw new AppError(401, "UNAUTHENTICATED", "Sign in to continue.");
  return success("Profile loaded.", { user: profile });
});

export const PATCH = endpoint(async (request) => {
  const data = await readBody(request, updateProfileSchema);
  const user = await requireUser();
  return success("Profile updated.", {
    user: await updateProfile(user.id, data),
  });
});
