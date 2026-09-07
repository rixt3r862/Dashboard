# Dashboard Improvement Sessions

Work one session at a time to keep usage manageable. Read this checklist before
starting; avoid repeating the full review. Run focused checks for each change.
At the end of every session, update this file and relist all unfinished sessions
in the response. After session 35, re-evaluate the Dashboard and all apps.

## Sessions

- [x] 1. Persistent checklist; full-catalog Dashboard search and individual app pinning.
- [ ] 2. Share the app catalog across Dashboard, Game Room, and Time Tools.
- [ ] 3. Hearts autosave and recovery.
- [ ] 4. Spades autosave and recovery.
- [ ] 5. Crazy 8s autosave and recovery.
- [ ] 6. Controlled update reloads with an Update ready action.
- [ ] 7. Resume shortcuts for all supported games.
- [ ] 8. Compact Dashboard panels, hide file paths, and relocate Clear Recent.
- [ ] 9. Simplify category launchers; add favorites/resume and remove placeholders.
- [ ] 10. Standardize utility navigation, themes, and save-status messages.
- [ ] 11. Standardize game controls while preserving individual designs.
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
