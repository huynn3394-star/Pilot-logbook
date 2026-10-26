# Visible Flight Log scan shortcuts — 26 October 2026

## Delivered behavior

Each saved flight in Schedule has a labelled teal camera button, `Scan Flight Log`, above its existing edit/weather footer. Logbook places the same button directly under the flight number in the first table column, so finding it does not require scrolling to the far-right edit column or opening Flight Detail first. The existing detail-page scanner and global image importer remain available.

The button delegates to the unchanged `image` action with the saved record's ID. The existing importer shows the selected flight, prefills its UTC date and aircraft family, rejects number/date mismatches and requires explicit review and saving. Cancel returns to the same flight. Preview never saves automatically; changing a FINAL record still requires its existing replacement permission and revision reason.

The implementation is a small presentation adapter scoped to `#app`, following the existing weather-highlight adapter pattern. It copies each existing edit control's record ID, escapes labels/attributes, avoids duplicate controls on re-render, and never accesses credentials or writes records. It does not observe or rebuild modal drafts. It follows existing list filtering and empty states. Buttons have visible text, keyboard operation, focus outlines and a 44px minimum touch height.

Navy/Teal, system fonts, the scan parser/OCR, FINAL/save/conflict logic, Weather/SPECI/TSRA/CB, ATPL, Firebase rules/Variables, schema and private data are unchanged. `public/app.js`, `public/lib`, all workspace/account/ATPL modules, shared tokens/styles and backend/provider code remain byte-for-byte identical to the baseline. Only the new adapter/style, their index loading and the static-shell version change at runtime. New files are precached; existing ATPL/OCR cache namespaces and user storage are not cleared.

## Verification

Baseline: `929152a101405f8d2093faacb068b8a6d98a9f38`.
Exact tested head: `3f129455eccb2143e79b34bfaf96474216aeccdf`.
Runtime source has been unchanged since `7cc1aa026e575401045b82ce51154e177cd2fc81`; later commits corrected browser-test synchronization/selectors only.
Hosted run: https://github.com/huynn3394-star/Pilot-logbook/actions/runs/40259967385
Job: `121369999337`.

- Four shortcut contract tests and syntax checks passed. Three expected missing-feature failures were first observed on unchanged runtime in run `40258236012`.
- Locked dependency install and account SDK build passed. The SDK fingerprint remains `da75c65e901d`.
- Full unit suite: **269 passed / 271 total / 2 failed**. Only the two previously documented history-fixture tests fail: `v4 rejects extended preferences without acknowledging pending edits; v5 replays the original reminder edit and keeps watchlist` and `v5 requires reload for grouped preferences while v6 still accepts flat v5 data`. No additional failure was observed. The workflow remains failed overall; it is not an all-green suite.
- **18 new browser scenarios passed**, errors `[]`: Chromium/WebKit, 320/390/820/1440px, both themes, plus cached offline entry in each engine. Assertions cover placement and actual 44px geometry, visibility without horizontal scrolling, keyboard activation, correct target/date/family, no duplicate buttons, filters, cancellation, mismatch, preview without saving, FINAL consent, global importer separation and retained offline records. Offline tests require an uncached origin request to fail; they do not run OCR recognition offline.
- **250 shared-interface**, **12 Weather-view** and **12 Weather-attention** scenarios passed, errors `[]`. Total explicitly enumerated browser scenarios: **292**.
- The protected-file diff against baseline passed. CI uses `contents: read` and does not commit, change refs or deploy.
- Verification artifact: `avilog-visible-scan-checks`, ID `12624447399`, **3477266 bytes**, SHA-256 `4824a00cd99f5b145469444d036cfef5a9796d5f83a68f66759d7ba8a28e3eac`.

Tests use synthetic guest records and OCR text, not private production records. They do not verify real camera hardware, recognition accuracy from real photographs, physical iPhone/iPad rendering or live Google/Firebase synchronization. Browser geometry and screenshots were captured; no manual screenshot-inspection claim is made. Code review was inline, not independent.

Earlier failures were traced to browser-test assumptions: measuring a detached node during the existing modal-close re-render, a status filter housed in the management menu, and selecting the desktop navigation before mobile CSS finished loading after WebKit offline reload. Tests now wait for the actual close event, measure a currently connected node, use existing controls and await the shared CSS. Runtime code was not modified to bypass these checks.

## Release safety

The release wrapper updates documentation only and preserves the exact tested runtime. Promote to the existing main branch with an expected-head lease; keep the existing Railway pilot-logbook / avilog-preview / preview service, hostname, Variables and Firebase configuration. Deployment completion must be verified separately.

After successful deployment, save unfinished work and reopen AviLog online to receive the new shell. Do not clear website data or downloaded ATPL banks. Newly created unsaved flights still follow the existing save-first rule; these shortcuts are for saved flight records.
