(function () {
  const ERROR_LOG_KEY = "dashboard.clientErrors.v1";
  const ERROR_LOG_LIMIT = 50;
  const IGNORED_ERROR_PATTERNS = [
    /Unchecked runtime\.lastError: The message port closed before a response was received/i,
    /The message port closed before a response was received/i,
  ];

  function errorMessage(value) {
    if (value instanceof Error) return value.message;
    if (value && typeof value === "object" && "message" in value) return String(value.message || "");
    return String(value ?? "");
  }

  function shouldIgnoreClientError(entry) {
    const text = [entry.message, entry.stack, entry.source].filter(Boolean).join("\n");
    return IGNORED_ERROR_PATTERNS.some((pattern) => pattern.test(text));
  }

  function readClientErrors() {
    try {
      const raw = window.localStorage?.getItem(ERROR_LOG_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function writeClientErrors(entries) {
    try {
      window.localStorage?.setItem(ERROR_LOG_KEY, JSON.stringify(entries.slice(0, ERROR_LOG_LIMIT)));
      return true;
    } catch {
      return false;
    }
  }

  function recordClientError(entry) {
    const normalized = {
      at: entry.at || new Date().toISOString(),
      type: entry.type || "error",
      message: String(entry.message || "Unknown client error"),
      source: entry.source || "",
      line: Number.isFinite(Number(entry.line)) ? Number(entry.line) : null,
      column: Number.isFinite(Number(entry.column)) ? Number(entry.column) : null,
      stack: entry.stack ? String(entry.stack).slice(0, 4000) : "",
      path: window.location?.pathname || "",
      userAgent: window.navigator?.userAgent || "",
    };
    if (shouldIgnoreClientError(normalized)) return false;
    return writeClientErrors([normalized, ...readClientErrors()]);
  }

  function downloadClientErrors() {
    const errors = readClientErrors();
    const blob = new Blob([JSON.stringify(errors, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    link.href = url;
    link.download = `dashboard-client-errors-${stamp}.json`;
    document.body?.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  if (!window.__dashboardClientErrorLoggerInstalled) {
    window.__dashboardClientErrorLoggerInstalled = true;
    window.DashboardErrorLog = {
      clear() {
        try {
          window.localStorage?.removeItem(ERROR_LOG_KEY);
          return true;
        } catch {
          return false;
        }
      },
      download: downloadClientErrors,
      key: ERROR_LOG_KEY,
      list: readClientErrors,
      record: recordClientError,
    };
    window.addEventListener("error", (event) => {
      recordClientError({
        type: "error",
        message: errorMessage(event.error || event.message),
        source: event.filename || "",
        line: event.lineno,
        column: event.colno,
        stack: event.error?.stack || "",
      });
    });
    window.addEventListener("unhandledrejection", (event) => {
      const reason = event.reason;
      recordClientError({
        type: "unhandledrejection",
        message: errorMessage(reason),
        stack: reason?.stack || "",
      });
    });
  }

  if (!("serviceWorker" in navigator)) return;

  const script = document.currentScript;
  const swUrl = script?.dataset?.sw || "./sw.js";
  const isLocalhost =
    location.hostname === "localhost" ||
    location.hostname === "127.0.0.1" ||
    location.hostname === "[::1]";
  let refreshing = false;

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
    navigator.serviceWorker
      .register(swUrl, { updateViaCache: "none" })
      .then((registration) => {
        registration.update().catch(() => {});

        navigator.serviceWorker.addEventListener("controllerchange", () => {
          if (refreshing) return;
          refreshing = true;
          window.location.reload();
        });
      })
      .catch(() => {});
  });
})();
