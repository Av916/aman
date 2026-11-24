import { setTimeout as delay } from "node:timers/promises";

const profiles = {
  baseline: { users: 50, seconds: 10 },
  normal: { users: 100, seconds: 20 },
  stress: { users: 500, seconds: 30 },
  spike: { users: 300, seconds: 10 },
  soak: { users: 30, seconds: 300 },
} as const;
const profile = process.argv[2] ?? "baseline";
if (!Object.hasOwn(profiles, profile))
  throw new Error("Select baseline, normal, stress, spike, or soak.");
const settings = profiles[profile as keyof typeof profiles];
const origin = new URL(process.env.LOAD_URL ?? "http://127.0.0.1:3105");
if (
  !["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname) ||
  origin.username ||
  origin.password
)
  throw new Error("Use a loopback target for the dedicated load-test server.");

type Route = { name: string; url: string; init?: RequestInit };
const slug = process.env.LOAD_VENUE_SLUG;
const pitchId = process.env.LOAD_PITCH_ID;
const venueId = process.env.LOAD_VENUE_ID;
const customerCookie = process.env.LOAD_CUSTOMER_COOKIE;
const ownerCookie = process.env.LOAD_OWNER_COOKIE;
const routes: Route[] = [
  { name: "landing", url: "/" },
  { name: "discovery", url: "/api/venues?sort=recent" },
  ...(slug
    ? [{ name: "venue", url: `/turfs/${encodeURIComponent(slug)}` }]
    : []),
  ...(pitchId
    ? [
        {
          name: "availability",
          url: `/api/pitches/${encodeURIComponent(pitchId)}/availability`,
        },
      ]
    : []),
  ...(customerCookie
    ? [
        {
          name: "history",
          url: "/api/bookings",
          init: { headers: { Cookie: customerCookie } },
        },
      ]
    : []),
  ...(ownerCookie && venueId
    ? ["calendar", "analytics"].map((name) => ({
        name,
        url: `/api/owner/${name}?venueId=${encodeURIComponent(venueId)}`,
        init: { headers: { Cookie: ownerCookie } },
      }))
    : []),
];
if (pitchId && customerCookie && process.env.LOAD_SLOT_ID)
  routes.push({
    name: "quote",
    url: "/api/bookings/quote",
    init: {
      method: "POST",
      headers: {
        Cookie: customerCookie,
        Origin: origin.origin,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        pitchId,
        slotIds: [process.env.LOAD_SLOT_ID],
        addons: [],
      }),
    },
  });

const data = routes.map((route) => ({
  route,
  times: [] as number[],
  errors: 0,
  limited: 0,
}));
const started = performance.now();
await Promise.all(
  Array.from({ length: settings.users }, async (_, worker) => {
    const ramp =
      profile === "stress"
        ? Math.round((worker / settings.users) * settings.seconds * 500)
        : profile === "spike"
          ? 1000
          : 0;
    if (ramp) await delay(ramp);
    let turns = worker;
    while (performance.now() - started < settings.seconds * 1000) {
      const entry = data[turns++ % data.length];
      const before = performance.now();
      try {
        const response = await fetch(new URL(entry.route.url, origin), {
          ...entry.route.init,
          redirect: "error",
          signal: AbortSignal.timeout(8000),
        });
        if (response.status === 429) entry.limited++;
        else if (!response.ok) entry.errors++;
        await response.arrayBuffer();
      } catch {
        entry.errors++;
      }
      entry.times.push(performance.now() - before);
      await delay(1000);
    }
  }),
);
console.info(
  JSON.stringify(
    {
      profile,
      ...settings,
      results: data.map(({ route, times, errors, limited }) => {
        const sorted = times.sort((a, b) => a - b);
        return {
          route: route.name,
          requests: times.length,
          p95Ms: Math.round(sorted[Math.ceil(times.length * 0.95) - 1] ?? 0),
          errors,
          limited,
        };
      }),
    },
    null,
    2,
  ),
);
