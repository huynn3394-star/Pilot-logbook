# Weather folder selector and quick search

Goal: one independent METAR/TAF quick-view switch per saved folder, and saved-airport search on the same toolbar row as Update all. Preserve Navy/Teal, fonts, SPECI and TSRA/CB warnings.
Baseline: 1624bc0ac166bda7c79de2397aed8f42374c60a1. Isolated branch: feat/weather-folder-switch-search-2026-10-25.

Design rulings: METAR/SPECI is the default preview. Explicit TAF selection affects that folder only; expanded details retain both original products. Missing selected products are labelled, not substituted. View selections survive refresh and tab remount but are not persisted/synced; quick search matches partial ICAO and supported exact IATA aliases already used by AviLog. Search is a local saved-list filter, not a new provider call. SPECI remains unfiltered.

Files: public/workspace/weather-watch-ui.js, public/ui/weather-attention.css, public/sw.js cache identifier; unit/browser tests and test-only readiness helpers. No schema, Firebase, provider, OCR, ATPL or font-token changes.

Verification ledger:
- [x] Add three unit contracts and observe expected failures on unchanged source in run 40186062109.
- [x] Implement view-only selectors/search, preserve collapse/focus, explicit missing products and unfiltered SPECI, update shell version.
- [x] 12 new Chromium/WebKit browser scenarios pass for light/dark at 320/390/820px.
- [x] Final run 40187540665: full units 265/267, only the two documented absent-history-fixture failures; gate rejects new failures.
- [x] 250 shared UI, 12 per-flight scan, 12 SPECI/highlight scenarios and existing weather management/offline/account suite pass.
- [x] Protected-file diff against baseline passes. Review runtime diff inline; no independent reviewer available.
- [x] Record exact evidence and limitations in docs/WEATHER-VIEW-CONTROLS.md.
- [ ] Promote with expected-head lease and verify existing Railway service (deployment result is reported separately after the release commit).

Test investigation: initial cached WebKit runs timed out in UI actions. Added test-only diagnostics and awaited the actual computed shared/new CSS before interactions. Folder-collapse tests now target and assert the label's effect rather than clicking the summary center occupied by a new toggle. Retained all offline/source/raw-text/data assertions. Production bytes unchanged across those test corrections.
Local runtime is unavailable (ClientError), so verification was executed on hosted CI. Physical iPhone/iPad and live cloud/provider integration remain untested in this change. No manual screenshot-review claim.
