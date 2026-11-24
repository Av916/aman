export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { getEnv } = await import("./lib/env");
    const { venueSettings } = await import("./modules/venues/settings");
    venueSettings();
    const { bookingSettings } = await import("./modules/bookings/settings");
    bookingSettings();
    process.env.NEXTAUTH_URL = getEnv().APP_URL;
  }
}
