"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Camera, MoveDown, MoveUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { VenueMap } from "./venue-map";
import { VenuePhoto } from "./gallery";
import {
  ConfirmAction,
  FormError,
  FormField,
  TextField,
  choiceClass,
  formValues,
  panelClass,
  useManagementRequest,
  value,
} from "./management-controls";
import { venueRequest } from "./api-client";
import { human, money } from "./format";
import { PitchForm, WeeklyForm } from "./pitch-editor";
import type { ManagedVenue } from "@/modules/venues/venue.types";

export const wizardSteps = [
  "Basic information",
  "Location",
  "Facilities",
  "Photos",
  "Cricket pitches",
  "Operating schedule",
  "Review and submit",
];

function Basics({ venue }: { venue?: ManagedVenue }) {
  const router = useRouter();
  const { run, busy, error } = useManagementRequest();
  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        const form = formValues(event);
        const payload = Object.fromEntries(
          ["name", "description", "contactPhone", "contactEmail"].map((key) => [
            key,
            value(form, key),
          ]),
        );
        void run(
          () =>
            venueRequest<{ venue: { id: string } }>(
              venue ? `/api/owner/venues/${venue.id}` : "/api/owner/venues",
              venue ? "PATCH" : "POST",
              payload,
            ),
          "Venue draft saved.",
          (result) => {
            router.push(`/owner/venues/${result.venue.id}?step=2`);
          },
        );
      }}
    >
      <TextField
        name="name"
        label="Venue name"
        required
        minLength={2}
        maxLength={100}
        defaultValue={venue?.name}
      />
      <FormField label="Description">
        <textarea
          name="description"
          className={`${choiceClass} min-h-28 p-3`}
          maxLength={2500}
          defaultValue={venue?.description}
        />
      </FormField>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField
          name="contactPhone"
          label="Public contact phone"
          type="tel"
          defaultValue={venue?.contactPhone}
        />
        <TextField
          name="contactEmail"
          label="Public contact email"
          type="email"
          defaultValue={venue?.contactEmail}
        />
      </div>
      <FormError error={error} />
      <Button type="submit" disabled={busy}>
        {busy ? "Saving…" : "Save and continue"}
      </Button>
    </form>
  );
}

function Location({ venue }: { venue: ManagedVenue }) {
  const router = useRouter();
  const [lat, setLat] = useState(venue.latitude?.toString() ?? "");
  const [lng, setLng] = useState(venue.longitude?.toString() ?? "");
  const pick = useCallback((latitude: number, longitude: number) => {
    setLat(String(latitude));
    setLng(String(longitude));
  }, []);
  const { run, busy, error } = useManagementRequest();
  const [mapOpen, setMapOpen] = useState(false);
  const points =
    venue.latitude === null || venue.longitude === null
      ? []
      : [
          {
            latitude: venue.latitude,
            longitude: venue.longitude,
            name: venue.name,
          },
        ];
  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        const form = formValues(event);
        const fields = Object.fromEntries(
          [
            "address",
            "locality",
            "city",
            "state",
            "postalCode",
            "country",
            "timezone",
          ].map((key) => [key, value(form, key)]),
        );
        void run(
          () =>
            venueRequest(`/api/owner/venues/${venue.id}`, "PATCH", {
              ...fields,
              latitude: lat === "" ? null : Number(lat),
              longitude: lng === "" ? null : Number(lng),
            }),
          "Venue location saved.",
          () => router.push(`/owner/venues/${venue.id}?step=3`),
        );
      }}
    >
      <TextField
        name="address"
        label="Street address"
        defaultValue={venue.address}
        maxLength={200}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        {(
          [
            "locality",
            "city",
            "state",
            "postalCode",
            "country",
            "timezone",
          ] as const
        ).map((key) => (
          <TextField
            key={key}
            name={key}
            label={
              key === "postalCode"
                ? "Postal code"
                : key === "timezone"
                  ? "IANA timezone"
                  : human(key)
            }
            defaultValue={venue[key]}
          />
        ))}
        <TextField
          name="latitude"
          label="Latitude"
          type="number"
          step="any"
          min="-90"
          max="90"
          value={lat}
          onChange={(e) => setLat(e.target.value)}
        />
        <TextField
          name="longitude"
          label="Longitude"
          type="number"
          step="any"
          min="-180"
          max="180"
          value={lng}
          onChange={(e) => setLng(e.target.value)}
        />
      </div>
      <Button
        type="button"
        variant="outline"
        onClick={() => setMapOpen(!mapOpen)}
      >
        {mapOpen ? "Hide map" : "Select on map"}
      </Button>
      {mapOpen && (
        <div>
          <p className="mb-2 text-sm text-muted">
            Select a point on the map or enter the coordinates above.
          </p>
          <VenueMap points={points} onPick={pick} />
        </div>
      )}
      <FormError error={error} />
      <Button type="submit" disabled={busy}>
        Save and continue
      </Button>
    </form>
  );
}

function Facilities({
  venue,
  options,
}: {
  venue: ManagedVenue;
  options: { id: string; name: string }[];
}) {
  const router = useRouter();
  const { run, busy, error } = useManagementRequest();
  const current = new Set(venue.amenities.map(({ amenity }) => amenity.id));
  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        const data = formValues(event);
        void run(
          () =>
            venueRequest(`/api/owner/venues/${venue.id}`, "PATCH", {
              amenityIds: data.getAll("amenity"),
            }),
          "Facilities saved.",
          () => router.push(`/owner/venues/${venue.id}?step=4`),
        );
      }}
    >
      <fieldset className="grid gap-2 sm:grid-cols-2">
        <legend className="mb-3 font-bold">Amenities at this venue</legend>
        {options.map((item) => (
          <label
            key={item.id}
            className="flex min-h-11 items-center gap-2 rounded-xl border border-border px-3"
          >
            <input
              name="amenity"
              type="checkbox"
              value={item.id}
              defaultChecked={current.has(item.id)}
            />
            {item.name}
          </label>
        ))}
      </fieldset>
      <FormError error={error} />
      <Button type="submit" disabled={busy}>
        Save and continue
      </Button>
    </form>
  );
}

function Media({ venue, maximum }: { venue: ManagedVenue; maximum: number }) {
  const router = useRouter();
  const { run, busy, error } = useManagementRequest();
  const base = `/api/owner/venues/${venue.id}/images`;
  async function reorder(index: number, direction: number) {
    const order = venue.images.map((image) => image.id);
    [order[index], order[index + direction]] = [
      order[index + direction],
      order[index],
    ];
    await run(
      () => venueRequest(`${base}/reorder`, "PATCH", { imageIds: order }),
      "Image order saved.",
    );
  }
  return (
    <div className="grid gap-5">
      {venue.images.length < maximum && (
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            const data = formValues(event);
            const files = data
              .getAll("files")
              .filter(
                (item): item is File => item instanceof File && item.size > 0,
              );
            void run(
              async () => {
                if (
                  !files.length ||
                  files.length > maximum - venue.images.length
                )
                  throw new Error(
                    "Choose images within the remaining gallery limit.",
                  );
                try {
                  for (const file of files) {
                    const upload = new FormData();
                    upload.set("file", file);
                    upload.set(
                      "altText",
                      value(data, "altText") || `${venue.name} cricket venue`,
                    );
                    await venueRequest(base, "POST", upload);
                  }
                } finally {
                  router.refresh();
                }
              },
              "Images uploaded.",
              () => {
                router.refresh();
              },
            );
          }}
        >
          <TextField
            label="Upload venue photos"
            type="file"
            name="files"
            accept="image/jpeg,image/png,image/webp"
            multiple
            required
          />
          <TextField
            label="Image description (optional)"
            name="altText"
            minLength={3}
            maxLength={160}
          />
          <Button type="submit" disabled={busy}>
            <Camera size={16} aria-hidden /> Upload images
          </Button>
          <p className="text-sm text-muted">
            {venue.images.length} of {maximum} images · JPEG, PNG or WebP
          </p>
        </form>
      )}
      <FormError error={error} />
      <div className="grid gap-4 sm:grid-cols-2">
        {venue.images.map((image, index) => (
          <article
            key={image.id}
            className="min-w-0 rounded-xl border border-border p-3"
          >
            <div className="relative mb-3 aspect-[1.66] overflow-hidden rounded-lg bg-highlight">
              <VenuePhoto
                src={image.imageUrl}
                alt={image.altText}
                sizes="(max-width: 640px) 90vw, 43vw"
              />
            </div>
            {image.isCover && <Badge tone="green">Cover photo</Badge>}
            <form
              className="my-3 flex flex-wrap items-end gap-2"
              onSubmit={(event) => {
                const data = formValues(event);
                void run(
                  () =>
                    venueRequest(`${base}/${image.id}`, "PATCH", {
                      altText: value(data, "altText"),
                    }),
                  "Image description saved.",
                );
              }}
            >
              <TextField
                name="altText"
                label="Image description"
                defaultValue={image.altText}
                required
                minLength={3}
                maxLength={160}
              />
              <Button type="submit" variant="outline" disabled={busy}>
                Save
              </Button>
            </form>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                aria-label="Move image earlier"
                variant="outline"
                size="icon"
                disabled={busy || index === 0}
                onClick={() => void reorder(index, -1)}
              >
                <MoveUp size={16} aria-hidden />
              </Button>
              <Button
                type="button"
                aria-label="Move image later"
                variant="outline"
                size="icon"
                disabled={busy || index === venue.images.length - 1}
                onClick={() => void reorder(index, 1)}
              >
                <MoveDown size={16} aria-hidden />
              </Button>
              {!image.isCover && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    void run(
                      () =>
                        venueRequest(`${base}/${image.id}`, "PATCH", {
                          isCover: true,
                        }),
                      "Cover photo saved.",
                    )
                  }
                >
                  Set cover
                </Button>
              )}
              <ConfirmAction
                label="Remove photo"
                description="Remove this photo from the venue gallery."
                path={`${base}/${image.id}`}
                method="DELETE"
                success="Photo removed."
              />
            </div>
          </article>
        ))}
      </div>
      <Button asChild>
        <Link href={`/owner/venues/${venue.id}?step=5`}>
          Continue to pitches
        </Link>
      </Button>
    </div>
  );
}

export function VenueWizard({
  venue,
  step,
  options = [],
  maxImages = 10,
}: {
  venue?: ManagedVenue;
  step: number;
  options?: { id: string; name: string }[];
  maxImages?: number;
}) {
  const router = useRouter();
  const { run, busy, error } = useManagementRequest();
  const self = venue ? `/owner/venues/${venue.id}` : "/owner/venues/new";
  const endpoint = venue ? `/api/owner/venues/${venue.id}` : "";
  const readOnly = venue && ["SUSPENDED", "ARCHIVED"].includes(venue.status);
  const showReview = venue && (step === 7 || readOnly);

  return (
    <div className="grid gap-5 xl:grid-cols-[14rem_minmax(0,1fr)]">
      <nav
        aria-label="Venue setup steps"
        className="flex flex-wrap content-start gap-2 xl:grid"
      >
        {wizardSteps.map((label, index) =>
          venue ? (
            <Link
              key={label}
              href={`${self}?step=${index + 1}`}
              aria-current={step === index + 1 ? "step" : undefined}
              className={`rounded-lg px-3 py-2 text-sm font-bold ${step === index + 1 ? "bg-highlight" : "text-muted hover:bg-surface"}`}
            >
              {label}
            </Link>
          ) : (
            <span
              key={label}
              className={`rounded-lg px-3 py-2 text-sm ${index ? "text-muted" : "bg-highlight font-bold"}`}
            >
              {label}
            </span>
          ),
        )}
      </nav>
      <section className={panelClass}>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-2xl font-extrabold">
            {showReview ? "Review and submit" : wizardSteps[step - 1]}
          </h2>
          {venue && (
            <Badge
              tone={
                venue.status === "APPROVED"
                  ? "green"
                  : venue.status === "PENDING_APPROVAL"
                    ? "amber"
                    : "neutral"
              }
            >
              {human(venue.status)}
            </Badge>
          )}
        </div>
        {showReview ? (
          <div className="grid gap-4">
            {venue.rejectionReason && (
              <p className="rounded-xl bg-background p-3 text-sm">
                Review feedback · {venue.rejectionReason}
              </p>
            )}
            <p className="text-muted">
              {venue.publishedAt
                ? "This listing is visible in discovery."
                : venue.status === "APPROVED"
                  ? "This listing is approved and ready to publish."
                  : venue.status === "PENDING_APPROVAL"
                    ? "An admin will review the listing before it can be published."
                    : "Preview the listing and complete the required information before submitting."}
            </p>
            <ul className="space-y-1 text-sm text-muted">
              <li>
                {[venue.city, venue.state].filter(Boolean).join(", ") ||
                  "Location pending"}
              </li>
              <li>
                {venue.images.length} photos · {venue.pitches.length} pitches
              </li>
            </ul>
            <FormError error={error} />
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline">
                <Link href={`${self}/preview`}>Preview listing</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/owner/venues">
                  {venue.status === "DRAFT"
                    ? "Keep as draft"
                    : "Back to venues"}
                </Link>
              </Button>
              {["DRAFT", "REJECTED"].includes(venue.status) && (
                <Button
                  disabled={busy}
                  type="button"
                  onClick={() =>
                    void run(
                      () => venueRequest(`${endpoint}/submit`, "POST"),
                      "Venue submitted for review.",
                    )
                  }
                >
                  Submit for approval
                </Button>
              )}
              {venue.status === "APPROVED" && !venue.publishedAt && (
                <Button
                  disabled={busy}
                  type="button"
                  onClick={() =>
                    void run(
                      () => venueRequest(`${endpoint}/publish`, "POST"),
                      "Venue published.",
                    )
                  }
                >
                  Publish listing
                </Button>
              )}
            </div>
            {venue.status !== "ARCHIVED" && (
              <div>
                <ConfirmAction
                  label="Archive venue"
                  description="Remove the venue from public discovery and keep its history."
                  path={endpoint}
                  method="DELETE"
                  success="Venue archived."
                  onDone={() => router.push("/owner/venues")}
                />
              </div>
            )}
          </div>
        ) : step === 1 || !venue ? (
          <Basics venue={venue} />
        ) : step === 2 ? (
          <Location venue={venue} />
        ) : step === 3 ? (
          <Facilities venue={venue} options={options} />
        ) : step === 4 ? (
          <Media venue={venue} maximum={maxImages} />
        ) : step === 5 ? (
          <div className="grid gap-5">
            {venue.pitches.map((pitch) => (
              <div
                key={pitch.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-3"
              >
                <div>
                  <p className="font-extrabold">{pitch.name}</p>
                  <p className="text-sm text-muted">
                    {human(pitch.pitchType)} · {money(pitch.basePrice)} / hour ·{" "}
                    {pitch.isActive ? "Active" : "Inactive"}
                  </p>
                </div>
                <Button variant="outline" asChild>
                  <Link href={`${self}/pitches/${pitch.id}`}>Manage pitch</Link>
                </Button>
              </div>
            ))}
            <details
              open={!venue.pitches.length}
              className="rounded-xl border border-border p-4"
            >
              <summary className="mb-3 cursor-pointer font-extrabold">
                Add a cricket pitch
              </summary>
              <PitchForm venueId={venue.id} />
            </details>
            <Button asChild>
              <Link href={`${self}?step=6`}>Continue to schedule</Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-5">
            {venue.pitches.length ? (
              venue.pitches.map((pitch) => (
                <details
                  key={pitch.id}
                  open={venue.pitches.length === 1}
                  className="rounded-xl border border-border p-4"
                >
                  <summary className="mb-3 cursor-pointer font-extrabold">
                    {pitch.name} · {pitch.slotDurationMinutes} minute slots
                  </summary>
                  <WeeklyForm pitch={pitch} />
                  <Link
                    href={`${self}/pitches/${pitch.id}`}
                    className="mt-3 inline-block text-sm font-bold text-brand-dot underline"
                  >
                    Manage durations, exceptions and pricing
                  </Link>
                </details>
              ))
            ) : (
              <p className="text-muted">
                Add a pitch to set its operating schedule.
              </p>
            )}
            <Button asChild>
              <Link href={`${self}?step=7`}>Review venue</Link>
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
