# Dashboard Re-evaluation

Date: 2026-09-09. Scope: the Dashboard, shared launchers, utility apps,
ScoreKeeper, and all catalogued card games after sessions 1-35.

## Overall Assessment

The planned improvements are implemented. Navigation and recovery are more
consistent, utility workflows offer better validation and copying, and games
provide more useful review and decision feedback. No new blocking problem was
found in the entry-page browser sweep. This is not an exhaustive rules audit or
a guarantee of behavior on every browser/device.

## Verification

- 160 automated tests cover shared helpers, saved-state recovery, score rules,
  utility calculations, QR roundtrips, history edits, roster persistence,
  meld feedback, hints, and service-worker asset existence.
- All 22 catalog entry URLs (including the Dashboard and SkyJo phone wrapper)
  were loaded at 1365px and 390px: no page JavaScript exceptions, failed local
  asset responses, broken image elements, or document-width overflow.
- Active-game checks exercised 5 Crowns inspection without discarding, Phase 10
  path feedback, SkyJo control placement/final-turn names, and Hearts/Spades
  four-card last-trick rendering in isolated Chromium contexts.
- Browser checks found and prompted fixes for SkyJo's narrow control-grid
  overflow, Phase 10's overlapping phone dock, and Spades' full-hand grid sizing.
  User saves were not modified.
- QR generation passed an offline browser reload using the real service worker,
  registered explicitly by the harness because localhost normally bypasses PWA
  caching for development.
- Browser scripts and screenshots are in /tmp/dashboard-qa; they are temporary
  QA artifacts, not a new project dependency.

## App Assessment

| Area | Assessment |
| --- | --- |
| Dashboard and launchers | Shared catalog, search, favorites, recents, and resume paths work together; all entry pages load. |
| Time/date/conversion tools | Validation and formatting now have focused tests; date math avoids UTC-today drift. |
| CashBox and Notepad | Explicit saved records, recovery, and error feedback reduce accidental loss; local-only storage still needs backups. |
| QR and URL tools | Local QR dependencies remove CDN reliance; templates and parsed URL fields use structured handling. |
| ScoreKeeper | Earlier-round correction uses existing replay logic with atomic validation; roster data remains separate from game history. |
| Hearts and Spades | Last-trick review complements recovery; Spades exposes the recorded scoring components and player bids. |
| Crazy 8s | Named draw settings apply consistently to bots, human controls, and restored games. |
| Phase 10 and 5 Crowns | Phase paths highlight relevant cards and missing requirements; 5 Crowns supports non-destructive group inspection. |
| SkyJo | Portrait controls sit after the human grid; the final-turn banner names remaining players. |
| Skip-Bo | Hints explain exposed-card reasoning and discard consequences without changing the engine or confirmation flow. |

## Remaining Risks and Follow-ups

1. Real Safari/iOS and Android device checks remain valuable, particularly
   camera permissions, alarm audio, wake locks, fullscreen, and touch/rotation.
   Chromium viewport emulation does not validate these platform behaviors.
2. Full game-length UI playthroughs, multi-tab update activation, printing, and
   assistive-technology checks were not exhaustively repeated in this batch.
3. Promote the temporary browser checks into a maintained CI suite before a
   future broad UI refactor. The normal npm test suite remains dependency-light.
4. Optional polish: collapse empty Dashboard shortcut sections on phones to put
   the app list nearer the top. This is a usability refinement, not a blocker.
5. Spades' felt table remains visually dense on phones, and its history uses
   horizontal scrolling. A simplified phone table would be a useful later polish
   pass; the full hand now stays within the viewport.

There are no unfinished numbered sessions. Future work should prioritize the
remaining real-device checks and regressions over another large feature batch.
