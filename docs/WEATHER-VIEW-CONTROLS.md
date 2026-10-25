# Weather folder controls — 25 October 2026

## Delivered behavior

Each saved folder has independent METAR and TAF preview buttons in its heading. METAR (including a SPECI observation when supplied) is the default. The chosen product is shown for every airport in that folder; a missing selected product is stated explicitly rather than silently substituting another product. Opening a station still shows both original observation and forecast texts.

Quick saved-airport search is on the same toolbar row as Cập nhật tất cả. It accepts case-insensitive partial ICAO codes and the existing supported exact IATA aliases, such as SGN/VVTS, HAN/VVNB and CAN/ZGGG. It does not search airport names or call an external airport database. Matching folders are temporarily revealed. Clear/ESC restores their previous collapse state. The result count deduplicates airports occurring in multiple groups.

Search and product selection are view state only. They survive weather refresh and navigation away/back within the current app session, but are not written to user records, synced to other devices, or retained after a full page reload. Cập nhật tất cả still refreshes all saved airports regardless of the search filter. The search input remains the same focused DOM element while reports update.

The SPECI panel continues to inspect every saved airport independently of the filter or selected product. Its Xem bản tin action clears a blocking filter and reveals the corresponding airport. TSRA/CB highlighting, source texts, red warning styles and the Bản lưu label under the airport code remain intact.

Navy/teal, typography, Compact layout foundations, Logbook/Flight Log import, OCR/parsers, ATPL, storage schema, Firebase rules/variables and weather-provider logic remain unchanged. Runtime changes are confined to weather-watch-ui.js, its presentation stylesheet and the service-worker version identifier. No user data or downloaded ATPL/OCR caches are cleared.

## Verified source and evidence

Baseline: 1624bc0ac166bda7c79de2397aed8f42374c60a1.
Tested commit: 8215523cc9dea513dc27ecc3ddc4213621927c5a.
Runtime application bytes have been unchanged since 36bd865796f415ba85e5fe6db4cc16c22fdfa2f1; later commits adjust test diagnostics and readiness checks only.
Final hosted run: https://github.com/huynn3394-star/Pilot-logbook/actions/runs/40187540665
Final job: 121151415167.

- Three new unit contracts passed after their expected failure on the unchanged implementation in run 40186062109.
- Locked install and account SDK build succeeded; SDK fingerprint da75c65e901d unchanged.
- Full unit suite: 265 passed / 267 total / 2 failed. The only failures remain the historical-fixture tests: `v4 rejects extended preferences without acknowledging pending edits; v5 replays the original reminder edit and keeps watchlist` and `v5 requires reload for grouped preferences while v6 still accepts flat v5 data`. They require absent historical commits documented by previous releases. The workflow correctly remains failed overall; the separate gate rejects additional failures.
- 12 new Weather-view scenarios passed across Chromium/WebKit, 320/390/820 px and both themes: independent selection, missing products, toolbar alignment, focus preservation, filtering/clear, collapse restoration, SPECI visibility, no data writes or extra provider calls, remount and offline operation.
- 250 shared UI scenarios, 12 per-flight scan scenarios and 12 SPECI/highlight scenarios passed (286 explicitly enumerated browser scenarios in total).
- The existing Weather group/management/offline/account-isolation integration suite also passed on both engines. Protected-file diff passed.
- Artifact avilog-weather-view-checks: ID 12597345809, 3,856,193 bytes, SHA-256 a787f2d93bc0b042eed2eaa64845154be1c73b3d2a488f736f7bcf6cf2546ea0.

Earlier hosted runs timed out in WebKit cached-navigation UI checks. Test-only diagnostics were added; the final tests wait for the real shared/new stylesheet values before interacting and click the folder label rather than the newly inserted product buttons. Assertions on offline connectivity, stale warnings and preserved records remain. No networking/storage implementation was changed to obtain the final result.

Testing uses synthetic local guest data, not private production accounts. It is not a physical iPhone/iPad, live-provider, camera or live Google/Firebase test. Geometry and screenshots are recorded by the browser runner; no claim of manual screenshot inspection or independent reviewer is made. Review was inline.

## Release

The release wrapper updates documentation only, preserving the exact tested runtime bytes. Promote to the existing main branch with an expected-head lease, then verify the existing Railway pilot-logbook / avilog-preview / preview deployment. Keep hostname, Variables, Firebase and user records unchanged.
After deployment succeeds, save unfinished input and reopen AviLog online. Do not clear website data or downloaded ATPL banks to refresh the interface.
