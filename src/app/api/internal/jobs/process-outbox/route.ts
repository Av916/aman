import { bookingJob } from "@/modules/jobs/http";

export const POST = bookingJob("outbox");
