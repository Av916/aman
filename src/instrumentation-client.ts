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
  if ("serviceWorker" in navigator)
    window.addEventListener(
      "load",
      () => void navigator.serviceWorker.register("/sw.js").catch(() => {}),
      { once: true },
    );
}
