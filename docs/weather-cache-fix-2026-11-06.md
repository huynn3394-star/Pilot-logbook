# VVPC saved-weather cache regression — 6 November 2026

Base: `5bd3fb3941bd2fa128073bc51d63870e8b6d4535` (`main`, including PR #12).

## Findings and evidence

The saved badge in `weather-watch-ui.js` is a presentation condition. It does not select a different bulletin. If text changes to day 30, an older report has entered or survived the underlying watch/cache; changing that label cannot repair it.

Confirmed defects:

1. **Installed PWA never received the previous client fix.** The weather changes in `c9c7efb`/`e5c7885` did not change `public/sw.js`. Its install cache name still came from `35b2b65`. The fetch handler serves installed shell modules from Cache Storage before attempting the network. A rebuild with the same Firebase SDK digest does not change that worker either. Native Chromium/WebKit tests reproduce an installed weather module remaining old while an independent network request sees the new bytes, then verify replacement by an actually activated new controller.
2. **IndexedDB writes were whole-snapshot replacements.** Every watch loaded once and wrote its own reports object to the same UID key. A second tab that had loaded day 30 could overwrite day 06 saved by another tab, even though each tab's in-memory merge was correct. A narrow watch could also remove other stations from disk. Native two-tab tests reproduce this ordering and check that the new transaction keeps both latest products and unrelated stations.
3. **Issue dates could change when data was fetched again.** `dayNear` selected the nearest month even if day 30 was two weeks in the future. With a 16 November receipt it interpreted `300630Z` as 30 November, which could beat a genuinely newer saved 6 November bulletin. Identical text fetched in successive months also received a different issue date. New unit tests failed against the original code for both cases. Other failures caught same-time COR downgrades, wrong-station raw text and an empty cold server returning success.

These are demonstrated failure paths, not a forensic claim about the user's particular device. Its original IndexedDB, installed worker and screenshot's full metadata were not accessible in this task.

## Repair

- Give the PWA a new shell version ending `weather-cache-20261106`; retain existing private/account storage and downloaded study assets.
- Use `weather-watch:v2:<scope>`. Migrate a legacy v1 snapshot once without deleting it; subsequent writes from pages still running the old v1 code cannot corrupt v2.
- Read, validate, merge by per-product issue time, and write in **one IndexedDB readwrite transaction**. Return the committed result to the writing watch. Preserve other stations and UID/guest boundaries.
- Persist validated `productIssuedAt` independently of receipt timestamps. Legacy dates use their original per-product receipt. Identical raw text does not acquire a different issue date after a later receipt. Retained products retain their own source, receipt and issue date. Preserve corrections when original and COR/AMD have equal issue times.
- Do not infer an issue weeks in the future. Near-future clock values remain available for validation; provider acceptance and watch validation reject issues more than ten minutes ahead of their receipt. TAF validity periods may still cross future days/months/years.
- Validate raw station/timing before a watch accepts it; keep previous reports on invalid replies or network failures.
- Calculate the saved label and invalid/old/expired flags from one UI helper. Changing connectivity or the label does not replace the text.
- A cold server with no usable products returns 502; a warm server retains its reports with `stale: true`. The server cache remains process-local; Railway restarts and replicas cannot supply durable history. The browser's monotonic cache protects its already-saved newer reports from an older server response.

The Firebase build regenerates the tracked source-hash manifest; SDK bytes/digest remain unchanged.

## Verification

Node 24.22.1. Commands below use the normal `node`/`npm` names; the local runner used the app-bundled Node executable because Node was absent from the shell PATH.

- `node scripts/build-atpl-account.mjs`: passed.
- `node --test tests/weather*.test.js tests/workspace-weather.test.js tests/taf-layout.test.js tests/workspace-service-worker.test.js tests/v14-build-cache.test.js`: **80/80 passed**.
- `npm run test:weather-cache`: **Chromium and WebKit passed**. Actual controlling-worker upgrade, two tabs sharing native IndexedDB, isolated legacy-v1 writes, preservation of other stations, UID isolation, failed API probe and native offline reopening. VVPC remains METAR `060630Z` and TAF `060500Z`, including under the saved badge and product switch.
- `node --test tests/*.test.js`: **310/312 passed**. The two failures are unchanged pre-existing expectations in `tests/navy-v2.test.js`: “Navy cards distinguish flight and block, next-day IN, FINAL and draft values” and “Navy 10,000-record results bound the initial DOM and totals include unloaded matching records”. Both also failed in the untouched-base run.
- Existing `verify-weather-ui.cjs`: compact weather checks passed at 390px/1024px, then stopped at the unrelated ATPL account-panel assertion on line 13. The same failure was reproduced from an untouched archive of the base commit.
- Existing `verify-weather-view.cjs`: reached its navigation-remount step but timed out on the old visible `[data-tab=weather]` selector at line 51. This legacy harness was not rewritten as part of the weather fix; it is not counted as a pass. The dedicated regression script mounts the real weather UI, verifies both product switches and the saved label, and tests persistence independently of navigation.
- `git diff --check`: passed.

Regression entry points: `tests/weather-cache-regression.test.js`, `scripts/verify-weather-cache.cjs`. Browser artifacts are written under `test-results/weather-cache/` (ignored runtime output).

## Railway and data limits

Read-only public probe: `GET https://avilog.up.railway.app/api/weather?station=VVPC`, HTTP 200, response Date **2026-11-06 10:19:38 UTC** (17:19:38 Vietnam), `Cache-Control: no-store`.

At that instant Railway returned METAR `METAR VVPC 061000Z … NOSIG=` and TAF `TAF VVPC 060500Z 0606/0706 …`, receipt `2026-11-06T10:15:14.687Z`, `cached: true`, no stale products. The public `weather-report.js` matched the base source; the public worker still had the pre-fix `…compact-counters-20261105-sdk-80c44a81f174` version. This proves that the live server had day-06 data at the sampled time, not that every previous request or replica did.

No Railway deploy/merge, Railway private logs, environment/credentials inspection, physical iPad/Safari test, or inspection of the user's actual browser cache was performed. A public health response exposes no commit SHA, so exact Railway deployment identity cannot be proven from it. This change must be deployed and the installed worker activated before it can affect that device; an already-open page needs to reload to execute the new modules.

Raw `DDHHMMZ` has no month/year. An old report lacking trustworthy original receipt metadata cannot have its historical month/year recovered with certainty; `300630Z` alone does not mean 30 June. The fix preserves established dates and prevents subsequent receipts from silently moving identical text into a new month. A cold server with only monthless upstream text still depends on the upstream's current-feed integrity. Storage/quota failures remain visible and cannot create durability that the browser has refused.
