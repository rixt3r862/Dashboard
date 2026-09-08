(function () {
  const root = document.documentElement;
  const key = "dash.theme";
  function readTheme() {
    try { return localStorage.getItem(key); } catch { return null; }
  }
  function applyTheme(value) {
    if (value === "light" || value === "dark") root.setAttribute("data-theme", value);
    else root.removeAttribute("data-theme");
  }
  function status(target, message) {
    const element = typeof target === "string" ? document.getElementById(target) : target;
    if (!element) return;
    element.setAttribute("role", "status");
    element.setAttribute("aria-live", "polite");
    element.textContent = message;
  }
  function save(key, value, target = "utilityStatus") {
    try {
      localStorage.setItem(key, value);
      status(target, "Saved on this device.");
      return true;
    } catch {
      status(target, "Unable to save on this device.");
      return false;
    }
  }
  applyTheme(readTheme());
  window.UtilityShell = { status, save };
  document.addEventListener("DOMContentLoaded", () => {
    const select = document.getElementById("utilityTheme");
    const sync = () => {
      const value = readTheme();
      applyTheme(value);
      select.value = value === "light" || value === "dark" ? value : "system";
    };
    sync();
    select.addEventListener("change", () => {
      applyTheme(select.value);
      try {
        if (select.value === "system") localStorage.removeItem(key);
        else localStorage.setItem(key, select.value);
        status("utilityStatus", "Theme saved on this device.");
      } catch {
        status("utilityStatus", "Theme changed for this page. Unable to save on this device.");
      }
    });
    window.addEventListener("pageshow", sync);
    window.addEventListener("storage", event => {
      if (event.key === key || event.key === null) sync();
    });
  });
})();
