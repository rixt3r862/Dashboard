# Dashboard Developer Notes

## New Standalone HTML Pages

When adding a new standalone page, include these head entries so browser/PWA tooling stays quiet and consistent:

- `rel="manifest"` pointing at the appropriate `app.webmanifest` path.
- `rel="icon"` for the page favicon.
- `rel="apple-touch-icon"` alongside the favicon. Microsoft Edge Tools flags pages that omit this.
- `shared/pwa.js` when the page should participate in the dashboard PWA/service-worker flow.

