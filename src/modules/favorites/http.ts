import { z } from "zod";
import { readBody } from "@/lib/api";
import { roleRoute, query, json } from "@/modules/venues/http";
import { favoriteInput } from "@/modules/venues/venue.validation";
import { listFavorites, saveVenue, unsaveVenue } from "./service";

const pageQuery = z.object({
  page: z.coerce.number().int().min(1).max(1000).default(1),
});
export const favoritesGet = roleRoute("CUSTOMER", async (r, id) =>
  json("Favorites loaded.", await listFavorites(id, query(r, pageQuery).page)),
);
export const favoritesPost = roleRoute("CUSTOMER", async (r, id) => {
  await saveVenue(id, (await readBody(r, favoriteInput)).venueId);
  return json("Venue saved.");
});
export const favoriteDelete = roleRoute<{ venueId: string }>(
  "CUSTOMER",
  async (_r, id, { venueId }) => {
    await unsaveVenue(id, venueId);
    return json("Venue removed from favorites.");
  },
);
