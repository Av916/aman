import { z } from "zod";
import { readBody } from "@/lib/api";
import { getPrisma } from "@/lib/prisma";
import { limitAttempt } from "@/modules/auth/rate-limit";
import {
  addPitch,
  editPitch,
  ownerPitch,
  setWeeklySchedule,
  addException,
  removeException,
  writePricing,
  pricingPitchId,
  ownerSlots,
  generateOwnerSlots,
  maintainSlots,
} from "@/modules/pitches/service";
import {
  pitchFields,
  pitchUpdate,
  slotMutation,
} from "@/modules/pitches/validation";
import { weeklySchedule, exceptionInput } from "@/modules/schedules/validation";
import { pricingInput } from "@/modules/pricing/validation";
import {
  readImageUpload,
  imageEdit,
  imageOrder,
} from "@/modules/media/validation";
import {
  uploadImage,
  reorderImages,
  editImage,
  deleteImage,
} from "@/modules/media/service";
import { query, ownerRoute, json } from "./http";
import {
  createVenue,
  editVenue,
  getOwnerVenue,
  ownerAction,
} from "./venue.service";
import { listManagedVenues } from "./venue.repository";
import {
  venueCreate,
  venueUpdate,
  venueListQuery,
  dayQuery,
} from "./venue.validation";

type Id = { id: string };
export const ownerVenueList = ownerRoute(async (r, ownerId) =>
  json(
    "Venues loaded.",
    await listManagedVenues(query(r, venueListQuery), ownerId),
  ),
);
export const ownerVenueCreate = ownerRoute(async (r, ownerId) =>
  json(
    "Venue drafted.",
    { venue: await createVenue(ownerId, await readBody(r, venueCreate)) },
    201,
  ),
);
export const ownerVenueGet = ownerRoute<Id>(async (_r, ownerId, { id }) =>
  json("Venue loaded.", { venue: await getOwnerVenue(ownerId, id) }),
);
export const ownerVenuePatch = ownerRoute<Id>(async (r, ownerId, { id }) =>
  json("Venue saved.", {
    venue: await editVenue(ownerId, id, await readBody(r, venueUpdate)),
  }),
);

export function ownerVenueAction(operation: "submit" | "publish" | "archive") {
  return ownerRoute<Id>(async (_r, ownerId, { id }) =>
    json("Venue status updated.", {
      venue: await ownerAction(ownerId, id, operation),
    }),
  );
}

export const ownerPitchesGet = ownerRoute<Id>(async (_r, ownerId, { id }) =>
  json("Pitches loaded.", {
    pitches: (await getOwnerVenue(ownerId, id)).pitches,
  }),
);
export const ownerPitchCreate = ownerRoute<Id>(async (r, ownerId, { id }) =>
  json(
    "Pitch created.",
    { pitch: await addPitch(ownerId, id, await readBody(r, pitchFields)) },
    201,
  ),
);
export const ownerPitchPatch = ownerRoute<Id>(async (r, ownerId, { id }) =>
  json("Pitch saved.", {
    pitch: await editPitch(ownerId, id, await readBody(r, pitchUpdate)),
  }),
);
export const ownerPitchDeactivate = ownerRoute<Id>(
  async (_r, ownerId, { id }) =>
    json("Pitch deactivated.", {
      pitch: await editPitch(ownerId, id, { isActive: false }),
    }),
);

export const scheduleGet = ownerRoute<Id>(async (_r, ownerId, { id }) => {
  await ownerPitch(ownerId, id);
  return json("Schedule loaded.", {
    hours: await getPrisma().operatingHours.findMany({
      where: { pitchId: id },
      orderBy: [{ dayOfWeek: "asc" }, { openingTime: "asc" }],
    }),
  });
});
export const schedulePut = ownerRoute<Id>(async (r, ownerId, { id }) =>
  json("Schedule saved.", {
    hours: await setWeeklySchedule(
      ownerId,
      id,
      await readBody(r, weeklySchedule),
    ),
  }),
);

export const exceptionsGet = ownerRoute<Id>(async (_r, ownerId, { id }) => {
  await ownerPitch(ownerId, id);
  return json("Exceptions loaded.", {
    exceptions: await getPrisma().scheduleException.findMany({
      where: { pitchId: id },
      orderBy: { date: "asc" },
      take: 200,
    }),
  });
});
export const exceptionsPost = ownerRoute<Id>(async (r, ownerId, { id }) =>
  json(
    "Exception added.",
    {
      exception: await addException(
        ownerId,
        id,
        await readBody(r, exceptionInput),
      ),
    },
    201,
  ),
);
export const exceptionDelete = ownerRoute<Id & { exceptionId: string }>(
  async (_r, ownerId, { id, exceptionId }) => {
    await removeException(ownerId, id, exceptionId);
    return json("Exception removed.");
  },
);

export const pricingGet = ownerRoute<Id>(async (_r, ownerId, { id }) => {
  await ownerPitch(ownerId, id);
  return json("Pricing loaded.", {
    rules: await getPrisma().pricingRule.findMany({
      where: { pitchId: id },
      orderBy: [{ priority: "desc" }, { id: "asc" }],
    }),
  });
});
export const pricingPost = ownerRoute<Id>(async (r, ownerId, { id }) =>
  json(
    "Rule created.",
    { rule: await writePricing(ownerId, id, await readBody(r, pricingInput)) },
    201,
  ),
);
export const pricingPatch = ownerRoute<Id>(async (r, ownerId, { id }) =>
  json("Rule saved.", {
    rule: await writePricing(
      ownerId,
      await pricingPitchId(ownerId, id),
      await readBody(
        r,
        z
          .record(z.string(), z.unknown())
          .refine(
            (value) => Object.keys(value).length > 0,
            "Supply a field to edit.",
          ),
      ),
      id,
    ),
  }),
);
export const pricingDelete = ownerRoute<Id>(async (_r, ownerId, { id }) => {
  await writePricing(ownerId, await pricingPitchId(ownerId, id), undefined, id);
  return json("Rule removed.");
});

export const slotsGet = ownerRoute<Id>(async (r, ownerId, { id }) =>
  json("Slots loaded.", await ownerSlots(ownerId, id, query(r, dayQuery).date)),
);
export const slotsGenerate = ownerRoute<Id>(async (_r, ownerId, { id }) =>
  json("Availability refreshed.", await generateOwnerSlots(ownerId, id)),
);
export function updateSlots(block: boolean) {
  return ownerRoute<Id>(async (r, ownerId, { id }) =>
    json(
      block ? "Slots blocked." : "Slots unblocked.",
      await maintainSlots(
        ownerId,
        id,
        (await readBody(r, slotMutation)).slotIds,
        block,
      ),
    ),
  );
}

export const imagesPost = ownerRoute<Id>(async (r, ownerId, { id }) => {
  await limitAttempt("venue-image-upload", r.headers, ownerId, {
    global: 1500,
    ip: 35,
    identity: 20,
  });
  const { file, altText } = await readImageUpload(r);
  return json(
    "Image uploaded.",
    { image: await uploadImage(ownerId, id, file, altText) },
    201,
  );
});
export const imagesReorder = ownerRoute<Id>(async (r, ownerId, { id }) =>
  json("Image order saved.", {
    images: await reorderImages(
      ownerId,
      id,
      (await readBody(r, imageOrder)).imageIds,
    ),
  }),
);

export const imagePatch = ownerRoute<Id & { imageId: string }>(
  async (r, ownerId, { id, imageId }) =>
    json("Image updated.", {
      image: await editImage(
        ownerId,
        id,
        imageId,
        await readBody(r, imageEdit),
      ),
    }),
);
export const imageDelete = ownerRoute<Id & { imageId: string }>(
  async (_r, ownerId, { id, imageId }) => {
    await deleteImage(ownerId, id, imageId);
    return json("Image removed.");
  },
);
