# Dashboard Developer Notes

## New Standalone HTML Pages

When adding a new standalone page, include these head entries so browser/PWA tooling stays quiet and consistent:

- `rel="manifest"` pointing at the appropriate `app.webmanifest` path.
- `rel="icon"` for the page favicon.
- `rel="apple-touch-icon"` alongside the favicon. Microsoft Edge Tools flags pages that omit this.
- `shared/pwa.js` when the page should participate in the dashboard PWA/service-worker flow.

## Game Room Shared Helpers

Hearts, SkyJo, and Phase10 load `shared/game-room.js` before their game scripts, then delegate common helpers through `window.GameRoom`. Keep the small local wrapper/fallback functions in each game script when adding shared helpers; they let the standalone pages keep working if the shared script fails to load during local testing or cache churn.

## Client-Side Error Logging

Production pages load a lightweight client-side error logger from `shared/pwa.js`. It stores the latest browser errors in `localStorage` under `dashboard.clientErrors.v1` and exposes `window.DashboardErrorLog` in DevTools with `list()`, `clear()`, `record(entry)`, and `download()` helpers. Known extension-origin noise such as `Unchecked runtime.lastError: The message port closed before a response was received` is filtered before storage.
