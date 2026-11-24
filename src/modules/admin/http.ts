import { readBody } from "@/lib/api";
import { listManagedVenues } from "@/modules/venues/venue.repository";
import {
  rejectVenueInput,
  venueListQuery,
} from "@/modules/venues/venue.validation";
import { json, query, roleRoute } from "@/modules/venues/http";
import { moderateVenue, venueReview } from "./venue-review";

export const adminList = roleRoute("ADMIN", async (r) =>
  json("Venues loaded.", await listManagedVenues(query(r, venueListQuery))),
);
export const adminDetail = roleRoute<{ id: string }>(
  "ADMIN",
  async (_r, _admin, { id }) => json("Venue loaded.", await venueReview(id)),
);
export const adminAction = (
  action: "approve" | "reject" | "suspend" | "restore",
) =>
  roleRoute<{ id: string }>("ADMIN", async (r, admin, { id }) =>
    json("Venue status updated.", {
      venue: await moderateVenue(
        admin,
        id,
        action,
        action === "reject"
          ? (await readBody(r, rejectVenueInput)).reason
          : undefined,
      ),
    }),
  );
