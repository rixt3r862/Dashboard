# Dashboard Improvement Sessions

Work one session at a time to keep usage manageable. Read this checklist before
starting; avoid repeating the full review. Run focused checks for each change.
At the end of every session, update this file and relist all unfinished sessions
in the response. After session 35, re-evaluate the Dashboard and all apps.

## Sessions

- [x] 1. Persistent checklist; full-catalog Dashboard search and individual app pinning.
- [x] 2. Share the app catalog across Dashboard, Game Room, and Time Tools.
- [x] 3. Hearts autosave and recovery.
- [x] 4. Spades autosave and recovery.
- [x] 5. Crazy 8s autosave and recovery.
- [x] 6. Controlled update reloads with an Update ready action.
- [x] 7. Resume shortcuts for all supported games.
- [x] 8. Compact Dashboard panels, hide file paths, and relocate Clear Recent.
- [x] 9. Simplify category launchers; add favorites/resume and remove placeholders.
- [x] 10. Standardize utility navigation, themes, and save-status messages.
- [x] 11. Standardize game controls while preserving individual designs.
- [ ] 12. CashBox amount validation, naming, and reset protection.
- [ ] 13. CashBox named deposit history and CSV export.
- [ ] 14. Notepad previous-version recovery and replace/append import.
- [ ] 15. Notepad named notes.
- [ ] 16. Timer countdown persistence and alarm initialization.
- [ ] 17. Timer named presets.
- [ ] 18. Clock fullscreen, date, screen-awake control, and second timezone.
- [ ] 19. Time Helper AM/PM selection and compact reference material.
- [ ] 20. Time Unit Converter precision, copying, and remembered unit pairs.
- [ ] 21. Unit Converter favorites and configurable precision.
- [ ] 22. Date Math local today, inclusive counting, and weekday calculations.
- [ ] 23. URL Tool parsed fields and individual copy actions.
- [ ] 24. QR Tool bundled libraries and offline verification.
- [ ] 25. QR Tool Wi-Fi/contact templates and output sizing.
- [ ] 26. ScoreKeeper earlier-round editing and recalculation.
- [ ] 27. ScoreKeeper reusable player roster.
- [ ] 28. Hearts last-trick review.
- [ ] 29. Spades last-trick review and scoring breakdowns.
- [ ] 30. Crazy 8s named draw-rule setting.
- [ ] 31. Phase 10 meld selection feedback and invalid-group explanations.
- [ ] 32. 5 Crowns meld selection feedback and invalid-group explanations.
- [ ] 33. SkyJo phone action placement and final-turn status.
- [ ] 34. Skip-Bo hint explanations.
- [ ] 35. Final integration checks, remaining high-value tests, and Dashboard re-evaluation.

## Session Log

Active checkout served by VS Code on localhost:5500:
`/Users/rickmosher/Documents/Development/Visual Studio Code/Software Development/GitHub/Dashboard`.
Use this checkout for subsequent sessions. The initially supplied workspace at
`/Users/rickmosher/Documents/GitHub/Dashboard` is a separate copy.

### Session 1

- Search includes nested apps by name, description, and path; exact-name Enter
  navigation uses the same results.
- Pinned nested apps remain on the homepage after clearing search. Unpinning
  returns them to search/category-only visibility.
- Added the missing desktop SkyJo entry alongside SkyJo Mobile.
- Registered focused search/persistence tests with npm test and bumped the
  service-worker cache version for the updated page.
- Restored the checkout into the workspace; existing local PNG/SVG icon changes
  are preserved and are not part of this session.
- Validation: all 6 focused search and Skip-Bo integration tests passed; inline
  scripts parsed successfully; git diff --check passed. Browser visual checks
  were unavailable because no browser was connected.
- Next: session 2. Commits/pushes follow the user's instructions.
- Follow-up: transferred session 1 to the active VS Code checkout after detecting
  the workspace mismatch. All 6 focused tests passed there, and the HTML fetched
  from localhost:5500 returned both SkyJo and SkyJo Mobile through its search
  helpers. Browser visual verification remains outstanding.

### Session 2

- Added shared/app-catalog.js as the single app catalog for all three launchers.
- Preserved Dashboard URLs for saved pins/recents, category ordering, icons,
  descriptions, and time-tool metadata. Category hrefs derive from canonical URLs.
- Included the catalog in the offline core cache and bumped its version.
- Updated search/integration tests and documented catalog maintenance in DEV_NOTES.md.
- Validation: all 70 tests passed; original category fields matched exactly;
  localhost:5500 served all updated pages and the catalog; syntax and diff checks
  passed. Browser visual verification was not performed.
- Next: session 3, Hearts autosave and recovery.

### Session 3

- Hearts now saves progress independently of named sessions and restores it on
  page load, including names, scores, difficulty, pass selection, and bot turns.
- Interrupted passes, trick collections, and claims finish on recovery without
  duplicating cards or scores. Completed hands/games remain completed.
- Invalid autosaves leave setup usable; storage errors display a status message.
  Reset clears autosave without deleting named sessions.
- Validation: all 32 focused recovery/shared-helper checks passed, including 7
  Hearts recovery tests. Updated JS and status markup verified on localhost:5500;
  script syntax and diff checks passed. Visual browser testing not performed.
- Sessions 2 and 3 are included in the combined sessions 2-5 checkpoint.
- Next: session 4, Spades autosave and recovery.

### Session 4

- Spades autosaves and restores bidding (including unsubmitted input), nil bids,
  bot difficulty, team scores/bags, active tricks, and completed games.
- Interrupted trick collection finishes without crediting the trick twice.
- Reset deletes only autosave. Invalid saves preserve setup and named sessions;
  storage failures show an explicit status.
- Validation: all 5 focused recovery tests passed, including a full hand restored
  after every play, completed games, corrupt data, and storage failures.
  Diff check passed. Browser/server verification unavailable: localhost:5500
  was stopped during this session.
- Next: session 5, Crazy 8s autosave and recovery.

### Session 5

- Crazy 8s now restores progress automatically, including pending eight suit
  selection, draw allowance, names/difficulty, bots, and completed rounds/games.
- Restoration cancels obsolete animation timers and clears transient busy state.
- Reset preserves named sessions. Corrupt autosaves leave setup available, and
  storage failures display an explicit message.
- Validation: all 86 project tests passed, including 4 new Crazy 8s recovery tests;
  diff checks passed. Visual browser testing remains outstanding.
- Sessions 2-5 form one commit/push checkpoint.
- Next: session 6, controlled update reloads.

### Session 6

- Updates wait for an explicit Update now action; Later dismisses the notice for
  the current page. Only the tab requesting activation reloads automatically.
- First installation does not prompt/reload. Updates installed during the visit
  are detected, and activation failures allow retry.
- Validation: 9 focused update/error-logger tests passed; diff check passed.
  Actual multi-tab browser verification remains outstanding.
- Rollout caveat: already-open pages running the old PWA script may reload once
  when this version activates; their old event handlers cannot be replaced remotely.
- Next: session 7, resume shortcuts for all supported games.

### Session 7

- Continue Playing now lists unfinished saves for ScoreKeeper, Phase 10, SkyJo,
  Hearts, Spades, Crazy 8s, 5 Crowns, and Skip-Bo with round/hand progress.
- Catalog metadata maps save keys and wrappers. SkyJo appears once; completed
  games are excluded, and named ScoreKeeper sessions remain accessible.
- Shortcuts update on storage changes and return navigation, and track recents.
- Validation: 10 focused catalog/search tests passed; inline scripts parse and
  diff checks passed. Visual browser testing remains outstanding.
- Next: session 8, Dashboard layout cleanup. Sessions 6-7 are local, pending push.

### Session 8

- Replaced oversized decorative shortcut panels with compact, unframed sections;
  shortened headings/empty states and stacked sections on phones.
- Moved Clear Recent into Recent and disabled it when history is empty.
- Removed visible file paths from app cards; long names wrap and cards fill their
  grid rows consistently.
- Validation: 10 focused catalog/search tests passed. Desktop Chrome screenshot
  and accessibility inspection confirmed the new sections and links.
  Mobile visual verification remains outstanding.
- Next: session 9, category launcher improvements.
- Sessions 6-8 form a combined commit/push checkpoint; all 95 project tests passed.

### Session 9

- Game Room and Time Tools share compact launcher styles and behavior, including
  favorites synchronized with Dashboard and canonical recent-history links.
- Game Room shows Continue Playing; Time Tools shows recent tools and no longer
  includes placeholder expansion sections.
- Added shared launcher assets to the service-worker cache and bumped its version.
- Validation: 16 focused catalog, search, integration, and launcher tests passed;
  desktop Chrome screenshots confirmed both layouts. Diff check passed.
  Mobile visual verification remains outstanding.
- Next: session 10, consistent utility navigation, themes, and save status.
- Session 9 is included in the combined sessions 9-10 checkpoint.

### Session 10

- All ten utilities use shared in-flow Dashboard navigation and a System/Light/Dark
  theme selector. Time utilities also link to Time Tools. Existing app designs and
  storage keys remain intact; theme changes synchronize across tabs and on return.
- Standardized device-local save success/failure messages and accessible status
  updates. Clock, Unit Converter, and Notepad preference writes report failures.
- Clock tolerates malformed/unavailable preferences; CashBox reports failed draft
  deletion accurately. Updated service-worker assets and cache version.
- Validation: full suite passed (105 tests); inline scripts and diff checks passed.
  Desktop Chrome verified Clock and Notepad, including a corrected editor width.
  Mobile visual checks and remaining utility visual checks are outstanding.
- Next: session 11, consistent game controls without changing individual designs.
- Sessions 9-10 form a combined commit/push checkpoint with the Skip-Bo fix below.

### Skip-Bo Discard Confirmation

- Human discards ask for confirmation with the card, destination pile, and an
  end-turn warning. Cancel preserves the table and selected card; bots are unchanged.
- Validation: all 108 project tests passed, including three confirmation tests;
  diff check passed. Service-worker cache bumped for delivery.
- Next planned work remains session 11.

### Session 11

- Standardized Reset Table, Load Session, and Delete Session labels across all
  seven card games (including SkyJo's shared phone view). Added reset tooltips,
  explicit button types, session-panel relationships, and live session status.
- Shared command buttons now have consistent minimum sizes, wrapping, keyboard
  focus indicators, coarse-pointer touch targets, and reduced-motion behavior.
- Preserved game-specific styles, card controls, rules, save formats, and the
  Skip-Bo discard confirmation. ScoreKeeper's separate scoring workflow is unchanged.
- Validation: all 115 project tests passed, including seven game-control checks;
  diff check passed. Browser visual verification remains outstanding.
- Next: session 12, CashBox validation, naming, and reset protection.
- Session 11 forms a combined commit/push checkpoint with the themed dialog below.

### Themed Skip-Bo Confirmation

- Replaced the browser discard prompt with a blue-and-gold modal matching Skip-Bo.
  Cancel receives initial focus; Escape dismisses it, and dismissal restores focus.
- Confirmation still names the card and pile and warns that the turn will end.
- Validation: all 117 project tests passed; diff check passed. Browser visual
  verification remains outstanding.
- Next planned work remains session 12.
