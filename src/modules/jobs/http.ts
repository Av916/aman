import { AppError, endpoint, success } from "@/lib/api";
import { deploymentSettings } from "@/lib/deployment";
import { bookingSettings } from "@/modules/bookings/settings";
import { validJobToken } from "@/modules/payments/signatures";
import { isJobName, runJob, type JobName } from "@/modules/system/jobs";

export function assertJobAuthorization(request: Request, cron = false) {
  const secret = cron
    ? deploymentSettings().CRON_SECRET
    : bookingSettings().INTERNAL_JOB_SECRET;
  if (!validJobToken(request.headers.get("authorization"), secret))
    throw new AppError(401, "UNAUTHENTICATED", "Invalid job credentials.");
}

export const bookingJob = (job: JobName) =>
  endpoint(async (request) => {
    assertJobAuthorization(request);
    return success("Job batch completed.", await runJob(job));
  });

export const cronGet = endpoint(
  async (request: Request, context: { params: Promise<{ job: string }> }) => {
    assertJobAuthorization(request, true);
    const { job } = await context.params;
    if (!isJobName(job))
      throw new AppError(404, "JOB_NOT_FOUND", "Unknown job.");
    return success("Job batch completed.", await runJob(job));
  },
);
