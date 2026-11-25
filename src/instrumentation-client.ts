if (process.env.NODE_ENV === "production") {
  let reported = false;
  const report = () => {
    if (reported) return;
    reported = true;
    navigator.sendBeacon(
      "/api/telemetry",
      new Blob(['{"event":"client_error"}'], { type: "application/json" }),
    );
  };
  window.addEventListener("error", report);
  window.addEventListener("unhandledrejection", report);
}

// Retire the offline worker for browsers that previously installed it.
if ("serviceWorker" in navigator) {
  void navigator.serviceWorker
    .getRegistration("/")
    .then(async (registration) => {
      const worker =
        registration?.active ??
        registration?.waiting ??
        registration?.installing;
      if (worker?.scriptURL !== new URL("/sw.js", location.origin).href) return;
      await registration?.unregister();
      await caches.delete("pitchmate-public-offline-v1");
    })
    .catch(() => {});
}
