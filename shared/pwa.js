(function () {
  if (!("serviceWorker" in navigator)) return;

  const script = document.currentScript;
  const swUrl = script?.dataset?.sw || "./sw.js";

  window.addEventListener("load", () => {
    navigator.serviceWorker.register(swUrl).catch(() => {});
  });
})();
