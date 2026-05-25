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

## 5 Crowns Standalone Game Plan

Future goal: add a standalone 5 Crowns table alongside Phase 10, SkyJo, Hearts, Spades, and Crazy 8s. Use the Crazy 8s standalone plan as the blueprint: build a narrow playable table first, then layer in history, session tools, animation, and scoring polish.

Current assumptions:

- Keep the app single-device: one human player plus one to four bots, with a default of four total players unless we decide the table feels better at three.
- Use the existing `ScoreKeeper/img/5 Crowns.png` preset art as the visual anchor.
- Treat 5 Crowns as a true sibling to the existing standalone card tables, not as an extension of ScoreKeeper only.
- Use Phase 10 as the primary layout/gameplay model: sidebar setup/status/piles, a player board, a large human hand workspace, embedded actions, and round history. Do not use the Crazy 8s table-seat/felt layout except as a source for card face/back sizing.
- Reuse shared resources before creating local one-offs: `shared/game-room.js`, `shared/game-room.css`, session/export helpers, shared bot-name and difficulty helpers, shared history sort controls, shared PWA/error logging, and established ScoreKeeper export patterns.
- Add a ScoreKeeper `fivecrowns` preset if one does not exist when implementation starts. Scoring should be low-score-wins, fixed 11-round session, with round scores equal to each player's remaining hand value after the round ends. Wire `ScoreKeeper/img/5 Crowns.png` into the preset background map at the same time.
- Export/import should follow the existing standalone game pattern and produce ScoreKeeper-compatible payloads.
- Use the official 5 Crowns rhythm as the default: 11 hands from 3 cards through 13 cards, with the wild rank matching the hand size each round.
- Model the 5-suit deck directly instead of trying to squeeze it into standard 4-suit card helpers.

Rules to confirm before implementation:

- Deck composition: confirm the exact local table convention for two 5-suit decks plus jokers, ranks 3 through king, no aces or twos.
- Wild values: likely current-round wild rank scores `20` points and jokers score `50`, while 3 through 10 score face value and jack/queen/king score `11`/`12`/`13`.
- Meld rules: confirm books require three or more cards of the same rank, runs require three or more sequential cards of the same suit, and wilds/jokers can fill either meld type.
- Going out: likely a player must arrange their full hand into valid books/runs and discard one card; after that, every other player gets one final turn before scoring.
- Turn flow: draw from stock or discard pile, optionally rearrange meld candidates, then discard. Confirm whether drawing the top discard is always allowed.
- Round start: deal hand size equal to the wild rank, reveal one discard, and advance dealer each round.
- Stock exhaustion: decide whether to reshuffle the discard pile under the top discard, end the round, or use another house rule.
- Bot information: bots should only use their own hands plus visible discard/round state; avoid omniscient meld decisions based on hidden hands.
- End condition: fixed 11 rounds, then lowest total score wins. Confirm whether ties remain ties or use a final-hand/lowest-round tiebreak.

Suggested build phases:

1. Scaffold `FiveCrowns/` with `index.html`, `fivecrowns.css`, and `fivecrowns.js`; start from the Phase 10 operational layout and shared helpers, then add it to the Games page, dashboard links, service-worker core assets, ScoreKeeper preset list, and standalone head checklist.
2. Implement core state: players, 5-suit deck, jokers, dealer, round number, hand size, wild rank, stock pile, discard pile, current player, turn stage, round scores, full-game totals, sessions, and ScoreKeeper export.
3. Build the first playable loop without clever meld assistance: deal, draw, discard, detect a manual go-out attempt, validate full-hand melds, give other players one final turn, score remaining cards, and advance rounds.
4. Add meld UX: selectable cards, suggested books/runs, staged meld groups, invalid-group feedback, remaining-card score preview, go-out availability, and compact rearrangement controls that work on mobile. Keep all card face/back components on the Crazy 8s `.playing-card` footprint so meld controls do not create a new card shape.
5. Add table polish: draw/discard pile animation, wild-rank indicator, dealer marker, final-turn banner, bot status, round history, session tools, and a distinct 5 Crowns theme.
6. Add bot strategy after the loop works: prefer draws that reduce deadwood, value wilds/jokers highly, build toward near-complete books/runs, discard high deadwood, and become more aggressive late in a round.
7. Add tests for deck construction, round wilds, card scoring, meld validation, go-out legality, final-turn behavior, round advancement, fixed-session winner logic, export payloads, and saved-session normalization.

Design direction:

- The 5 Crowns table should feel richer and more regal than Crazy 8s, but still like a working game surface rather than a decorative landing page.
- Build from the logo palette: royal purple field (`#6b3190`), deep violet lettering (`#492983`), crown orange/gold (`#e17f26`, `#f79824`, `#fbce3f`, `#fdd56a`), white border/trim, and suit accents in red (`#eb2027`), green (`#1ba650`), blue (`#1472ba`), yellow (`#fbce3f`), and near-black (`#070708`).
- Use the preset art as a branded table or setup-panel mark, not a full-page wallpaper. Let the purple and crown-gold tones carry the table surface, buttons, winner states, and wild-rank badge.
- Match Crazy 8s card proportions exactly for both faces and backs: `aspect-ratio: 5 / 7`, default width `4.35rem`, mobile width `3.7rem`, mini-card width around `2.8rem` to `3.1rem`, rounded `0.55rem` face corners, and the same border/inner-shadow feel. Only the 5 Crowns suits, colors, typography, and back pattern should differ.
- Build the identity around five clear suit colors, crown/star motifs used sparingly, a prominent wild-rank badge, and clean meld zones.
- Prioritize hand organization. This game will live or die by how pleasant it feels to sort, group, ungroup, and understand leftover card value.
- Keep the first version readable over flashy: compact controls, stable card dimensions, obvious selected/playable states, and no layout shifts when hands grow to 13 cards.

## Client-Side Error Logging

Production pages load a lightweight client-side error logger from `shared/pwa.js`. It stores the latest browser errors in `localStorage` under `dashboard.clientErrors.v1` and exposes `window.DashboardErrorLog` in DevTools with `list()`, `clear()`, `record(entry)`, and `download()` helpers. Known extension-origin noise such as `Unchecked runtime.lastError: The message port closed before a response was received` is filtered before storage.

When diagnosing a future browser-only issue, suggest this flow:

1. Open DevTools on the affected page and run `DashboardErrorLog.clear()`.
2. Reproduce the issue.
3. Run `DashboardErrorLog.list()` to inspect captured entries.
4. Run `DashboardErrorLog.download()` and attach the downloaded JSON file for review.

For a quick logger sanity check, run `DashboardErrorLog.record({ type: "manual", message: "Logger test" })`, then `DashboardErrorLog.download()`.
