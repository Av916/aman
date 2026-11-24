import {
  ownerVenueGet,
  ownerVenuePatch,
  ownerVenueAction,
} from "@/modules/venues/owner-http";

export const GET = ownerVenueGet;
export const PATCH = ownerVenuePatch;
export const DELETE = ownerVenueAction("archive");
