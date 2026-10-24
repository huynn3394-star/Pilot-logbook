# AviLog — Navy + Teal presentation update

Approved scope: retain AviLog's navy brand and existing V13 Compact/V14 flight editor, with one teal accent. The visual preview is a color reference, not permission to change data, flight-time controls, navigation, or add integrations.

## Implemented

- Existing navy `#142744`, white/gray neutrals and Compact layout remain unchanged.
- Teal text `#0f766e` on light surfaces; `#2dd4bf` on dark surfaces. These are two readable shades of the same accent.
- Selected navigation, Save/primary actions and key totals use teal. Draft and unconfirmed data remain neutral with existing labels. Genuine errors retain an error color.
- A protected original FINAL record may use the teal status; merely checking the unsaved confirmation checkbox does not turn the saved status teal.
- Added `public/navy-teal.css` after the existing stylesheet. No modifications to app.js, flight editor logic, schema, Firebase rules, account SDK source, ATPL data/keys/media, OCR, providers or Railway variables.
- Service-worker shell: `avilog-shell-v14-fast-entry-navy-teal-sdk-<bundle hash>`. Preserves the SDK hash guard and separate bank/OCR caches. No IndexedDB, account data or study progress reset.
- Three pinned cache-version expectations in two tests were updated for the deliberate presentation revision. Assertions and test coverage remain; no tests were skipped.

## Verification, 24 October 2026

Baseline application commit: `4ac692ed22c27b598692c93de99251c5185e7944`.
Verified application commit: `0ee62dfb6e3b0a734471ac2cfe047d0db42029b8`.
Final documentation-only release commit does not change these tested application bytes.

GitHub Actions run: https://github.com/huynn3394-star/Pilot-logbook/actions/runs/40105977992
Artifact: https://github.com/huynn3394-star/Pilot-logbook/actions/runs/40105977992/artifacts/12564517438

- Node 24.12.0; locked npm install and account SDK build succeeded. SDK hash remains `da75c65e901d`.
- Complete unit suite: **235 passed / 237 total / 2 failed / 0 skipped**. The same two failures were observed before the UI change: weather-upgrade v4→v5 needs missing commit `15bb922`; v5→v6 needs missing commit `5a47d5a`. Both tests remain intact and the overall workflow is correctly marked failed. This is not an all-green suite.
- **18/18 UI/offline scenarios passed**, errors `[]`: Chromium and WebKit, 320/390/820/1440 px, light/dark; selected-tab underline, field/label/Save contrast, focus visibility, no horizontal overflow and field preservation across tabs.
- Chromium offline flag: new CSS and installed shell reopen without network; localStorage sentinel retained.
- WebKit offline test stops the local server and verifies an uncached API request fails before reloading the cached app. This avoids the known Playwright WebKit offline-flag failure; it is not an iOS airplane-mode test.
- The new palette test was first run against the old UI and failed because the accent token was absent (run `40104754699`); it passes on the implementation.
- The lockfile's npm audit still reports 13 vulnerabilities (6 moderate, 7 high), also present before this UI work. Dependencies were not changed or auto-fixed. These require a separate security review.

Tests run the real local web app/server/service worker with fresh guest/demo storage. They do not use production credentials, modify user records or claim physical iPhone/iPad, live Google OAuth or cloud-account validation.

## Release and reopening

Deploy to the existing `avilog-preview` service in the `pilot-logbook` project, environment `preview`, existing domain `avilog.up.railway.app`. Do not change Firebase rules/variables or create a replacement project.

After successful deployment, open the app online, close older tabs/PWA and reopen or reload to receive the new shell. Keep site data; do not clear IndexedDB or offline banks. This color-only change can be reverted with a forward presentation update that keeps the V14 data-capable application; do not downgrade to pre-V14 code.
