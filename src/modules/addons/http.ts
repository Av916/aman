import { endpoint, readBody } from "@/lib/api";
import { json, ownerRoute, throttleDiscovery } from "@/modules/venues/http";
import { idSchema } from "@/modules/venues/venue.validation";
import {
  addAddon,
  addonInput,
  addonPatch,
  editAddon,
  venueAddons,
} from "./service";

type Id = { id: string };
export const addonsPublicGet = endpoint(
  async (r: Request, context: { params: Promise<{ slug: string }> }) => {
    await throttleDiscovery(r.headers);
    return json("Add-ons loaded.", {
      addons: await venueAddons(idSchema.parse((await context.params).slug)),
    });
  },
);
export const addonsOwnerGet = ownerRoute<Id>(async (_r, owner, { id }) =>
  json("Add-ons loaded.", { addons: await venueAddons(id, owner) }),
);
export const addonsOwnerPost = ownerRoute<Id>(async (r, owner, { id }) =>
  json(
    "Add-on created.",
    { addon: await addAddon(owner, id, await readBody(r, addonInput)) },
    201,
  ),
);
export const addonOwnerPatch = ownerRoute<Id>(async (r, owner, { id }) =>
  json("Add-on saved.", {
    addon: await editAddon(owner, id, await readBody(r, addonPatch)),
  }),
);
export const addonOwnerDelete = ownerRoute<Id>(async (_r, owner, { id }) =>
  json("Add-on deactivated.", {
    addon: await editAddon(owner, id, { isActive: false }),
  }),
);
