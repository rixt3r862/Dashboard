(function () {
  if (!("serviceWorker" in navigator)) return;

  const script = document.currentScript;
  const swUrl = script?.dataset?.sw || "./sw.js";
  const isLocalhost =
    location.hostname === "localhost" ||
    location.hostname === "127.0.0.1" ||
    location.hostname === "[::1]";

  window.addEventListener("load", () => {
    if (isLocalhost) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => {
          registration.unregister().catch(() => {});
        });
      });
      if ("caches" in window) {
        caches.keys().then((keys) => {
          keys
            .filter((key) => key.startsWith("dashboard-v"))
            .forEach((key) => caches.delete(key).catch(() => {}));
        });
      }
      return;
    }
    navigator.serviceWorker.register(swUrl).catch(() => {});
  });
})();
