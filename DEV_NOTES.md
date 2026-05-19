# Dashboard Developer Notes

## New Standalone HTML Pages

When adding a new standalone page, include these head entries so browser/PWA tooling stays quiet and consistent:

- `rel="manifest"` pointing at the appropriate `app.webmanifest` path.
- `rel="icon"` for the page favicon.
- `rel="apple-touch-icon"` alongside the favicon. Microsoft Edge Tools flags pages that omit this.
- `shared/pwa.js` when the page should participate in the dashboard PWA/service-worker flow.

## Game Room Shared Helpers

Hearts, SkyJo, and Phase10 load `shared/game-room.js` before their game scripts, then delegate common helpers through `window.GameRoom`. Keep the small local wrapper/fallback functions in each game script when adding shared helpers; they let the standalone pages keep working if the shared script fails to load during local testing or cache churn.

## Crazy 8s Standalone Game Plan

Future goal: add a standalone Crazy 8s table alongside Phase 10, SkyJo, Hearts, and Spades. Do not start by coding everything at once; build it in a thin playable slice first.

Current assumptions:

- Use the existing `ScoreKeeper/img/Crazy8s.png` preset art as the visual anchor.
- Keep the app single-device: one human player plus one to three bots.
- Treat Crazy 8s as a true sibling to Hearts and Spades, not as a separate experimental layout.
- Reuse the Hearts/Spades-style card table structure where practical: setup/sidebar, central table area, player seats, human hand panel, action controls, and history panel.
- Match Hearts/Spades hand and round history conventions, with special round notes folded into score cells rather than split into extra status columns.
- Reuse applicable Hearts/Spades card animations and interaction patterns, including deal-in, pass/draw/play motion, selectable cards, playable/illegal states, and round-end feedback.
- Use relevant shared resources before creating local one-offs: `shared/game-room.js`, `shared/game-room.css`, existing session/export helpers, shared bot-name and difficulty helpers, shared history sort controls, shared PWA/error logging, and any established ScoreKeeper export helpers.
- Align scoring with the existing ScoreKeeper `crazy8s` preset: target `100`, high score wins, winner-only scoring where the round winner has `0` hand points and receives the total of opponents' hand points.
- Export/import should follow the existing standalone game pattern and produce ScoreKeeper-compatible payloads.

Rules to confirm before implementation:

- Deal size: default to 5 cards per player unless we decide to use 7 for two-player tables.
- Starter discard: if the initial discard card is an 8, return it to a random location in the draw pile and reveal another discard. Repeat until the starting discard is not an 8. No suit is declared until a player actually plays an 8.
- Draw rule: decide between "draw one, then pass if still unable to play" and "draw until playable."
- Eight rule: 8s are wild and require choosing the next suit.
- Optional action-card rules: decide whether to keep the first version classic/simple or include house rules such as draw-two, skip, reverse, or ace/queen variants. Recommendation for first version: keep only the wild 8 rule, then add house-rule toggles later if desired.
- End condition: likely first player to hit the target wins under ScoreKeeper's current high-score preset behavior, but confirm whether the standalone game should instead stop at target and declare the highest score, or support a fixed number of rounds.

Suggested build phases:

1. Scaffold `Crazy8s/` with `index.html`, `crazy8s.css`, and `crazy8s.js`; start from the Hearts/Spades table layout rather than the Phase 10/SkyJo operational layout, then add it to the Games page, dashboard links, service-worker core assets, and standalone head checklist.
2. Implement core state: players, deck, discard pile, current suit, current player, draw/pass/play stages, round history, sessions, and ScoreKeeper export.
3. Build the first playable loop: deal, match by suit/rank, play an 8 and choose suit, draw/pass, bots take legal turns, detect empty hand, score the round.
4. Add UI polish: draw/discard piles, declared-suit indicator, playable-card highlighting, bot status, hand/round history, session tools, and a distinct Crazy 8s theme based on the blue/yellow/green preset art.
5. Add bot strategy after the loop works: prefer playable non-8s, save 8s for blocked hands or finishing pressure, choose declared suit by strongest suit count, and consider opponent hand size.
6. Add tests for scoring, legal plays, wild-suit declaration, draw/pass behavior, round-end scoring, export payloads, and saved-session normalization.

Design direction:

- Do not mimic Spades/Hearts/Phase 10 directly. The Crazy 8s image feels comic, bright, and arcade-like: electric blue table, bold yellow accents, black shadowing, and a small green pop.
- Use the preset art as a branded table or human-area watermark rather than full-page wallpaper, then tune after screenshot review.
- Keep controls compact and game-table-like, with clear suit-color affordances and a prominent current-suit indicator after an 8 is played.

## Client-Side Error Logging

Production pages load a lightweight client-side error logger from `shared/pwa.js`. It stores the latest browser errors in `localStorage` under `dashboard.clientErrors.v1` and exposes `window.DashboardErrorLog` in DevTools with `list()`, `clear()`, `record(entry)`, and `download()` helpers. Known extension-origin noise such as `Unchecked runtime.lastError: The message port closed before a response was received` is filtered before storage.

When diagnosing a future browser-only issue, suggest this flow:

1. Open DevTools on the affected page and run `DashboardErrorLog.clear()`.
2. Reproduce the issue.
3. Run `DashboardErrorLog.list()` to inspect captured entries.
4. Run `DashboardErrorLog.download()` and attach the downloaded JSON file for review.

For a quick logger sanity check, run `DashboardErrorLog.record({ type: "manual", message: "Logger test" })`, then `DashboardErrorLog.download()`.
