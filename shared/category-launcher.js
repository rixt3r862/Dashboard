(function (global) {
  const PINS = "dash.pinnedApps";
  const RECENTS = "dash.recentApps";
  function read(key) {
    try {
      const value = JSON.parse(global.localStorage.getItem(key) || "[]");
      return Array.isArray(value) ? value : [];
    } catch { return []; }
  }
  function write(key, value) {
    try { global.localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch { return false; }
  }
  function init(category, apps) {
    const byUrl = new Map(apps.map(app => [app.dashboardUrl, app]));
    const status = document.getElementById("launcherStatus");
    function visit(url) {
      if (!byUrl.has(url)) return;
      write(RECENTS, [{ url, ts: Date.now() }, ...read(RECENTS).filter(item =>
        item && item.url !== url && typeof item.url === "string" && Number.isFinite(item.ts))].slice(0, 6));
    }
    function link(app, progress) {
      const a = document.createElement("a");
      a.href = app.href;
      a.className = "shortcut";
      a.dataset.appUrl = app.dashboardUrl;
      a.textContent = app.name;
      if (progress) {
        const detail = document.createElement("small");
        detail.textContent = progress;
        a.appendChild(detail);
        a.setAttribute("aria-label", "Resume " + app.name + ", " + progress);
      }
      return a;
    }
    function render() {
      const pins = new Set(read(PINS).filter(url => typeof url === "string"));
      const favorites = apps.filter(app => pins.has(app.dashboardUrl));
      const favoriteList = document.getElementById("favorites");
      favoriteList.replaceChildren(...favorites.map(app => link(app)));
      document.getElementById("favoritesEmpty").hidden = favorites.length > 0;
      document.getElementById("favoriteCount").textContent = String(favorites.length);
      const shortcuts = category === "games"
        ? global.DashboardCatalog.resumableApps().filter(app => byUrl.has(app.url))
          .map(app => ({ app: byUrl.get(app.url), progress: app.progress }))
        : read(RECENTS).filter(item => item && byUrl.has(item.url))
          .map(item => ({ app: byUrl.get(item.url) }));
      document.getElementById("activity").replaceChildren(...shortcuts.map(item => link(item.app, item.progress)));
      document.getElementById("activityEmpty").hidden = shortcuts.length > 0;
      const grid = document.getElementById("appsGrid");
      grid.replaceChildren();
      for (const app of apps) {
        const item = document.createElement("article");
        item.className = "app-item";
        const a = link(app);
        a.className = "app-link";
        a.textContent = "";
        const icon = document.createElement("span");
        icon.className = "app-icon";
        icon.setAttribute("aria-hidden", "true");
        icon.textContent = app.icon;
        const text = document.createElement("span");
        const name = document.createElement("span");
        name.className = "app-name";
        name.textContent = app.name;
        const desc = document.createElement("span");
        desc.className = "app-desc";
        desc.textContent = app.desc;
        text.append(name, desc);
        a.append(icon, text);
        const pin = document.createElement("button");
        pin.type = "button";
        pin.className = "pin";
        pin.textContent = pins.has(app.dashboardUrl) ? "\u2605" : "\u2606";
        pin.setAttribute("aria-pressed", String(pins.has(app.dashboardUrl)));
        pin.title = (pins.has(app.dashboardUrl) ? "Unpin " : "Pin ") + app.name;
        pin.setAttribute("aria-label", pin.title);
        pin.addEventListener("click", () => {
          const updated = new Set(read(PINS).filter(url => typeof url === "string"));
          if (updated.has(app.dashboardUrl)) updated.delete(app.dashboardUrl);
          else updated.add(app.dashboardUrl);
          if (!write(PINS, [...updated])) { status.textContent = "Unable to save favorites on this device."; return; }
          status.textContent = "";
          render();
          grid.querySelectorAll(".pin")[apps.indexOf(app)]?.focus();
        });
        item.append(a, pin);
        grid.appendChild(item);
      }
    }
    let theme;
    try { theme = global.localStorage.getItem("dash.theme"); } catch {}
    document.documentElement.classList.toggle("dark",
      theme ? theme === "dark" : global.matchMedia("(prefers-color-scheme: dark)").matches);
    document.getElementById("themeToggle").addEventListener("click", () => {
      const dark = document.documentElement.classList.toggle("dark");
      try { global.localStorage.setItem("dash.theme", dark ? "dark" : "light"); } catch {}
    });
    document.addEventListener("click", event => {
      const a = event.target.closest("a[data-app-url]");
      if (a) visit(a.dataset.appUrl);
    });
    global.addEventListener("pageshow", render);
    global.addEventListener("storage", event => {
      if (event.key === null || [PINS, RECENTS, ...apps.filter(app => app.resume).map(app => app.resume.key)].includes(event.key)) render();
    });
    render();
  }
  global.CategoryLauncher = { init };
})(window);
