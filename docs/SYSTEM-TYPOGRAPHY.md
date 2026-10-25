# AviLog native-system typography — 25 October 2026

## Implemented scope

- Main interface, headers, controls, ATPL library and question screens consume the same native-first stack: `-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, Helvetica, Arial, sans-serif`.
- Headings use the shared interface family. Explicit DM Sans/Manrope declarations and both old Google Fonts imports were removed; the existing optional web-font source now requests Inter. No font binaries are included or distributed.
- Flight clocks and summaries use the native monospace stack with tabular figures. Existing colors, dimensions, spacing, sizes and weights remain unchanged.
- Navy `#142744`, teal light/dark variants and genuine weather warning colors are unchanged. SPECI remains at the top of Weather; TSRA/CB and the saved label retain the released behavior.
- New shell identifier: `avilog-shell-v14-fast-entry-navy-teal-unified-weather-attention-sf-ui-sdk-da75c65e901d`. ATPL/OCR caches and private local data are not cleared.
- Application logic, stored-data schema, Firebase rules/variables, dependencies, OCR, original ATPL question/key/media data and weather provider code are unchanged from `5dfbd15b78fd81b7dc68ebb8f1b7a5feca9a05de`.

This is an Apple-system-style interface choice, not Facebook's proprietary wordmark or a claim of pixel-identical Facebook typography. The actual rendered fallback depends on the operating system and font availability.

## Verified source and test evidence

Baseline: `5dfbd15b78fd81b7dc68ebb8f1b7a5feca9a05de`.
Exact tested application source commit: `4df09ccc6825683dec0d361075ceb2480f3c7b50`.
Verification run: https://github.com/huynn3394-star/Pilot-logbook/actions/runs/40170315309
Artifact: `avilog-font-ui-tests`, ID `12589113762`, ZIP 3,965,260 bytes, SHA-256 `36ea55956161546514a8bae3ed0fdca9a20e1040bf060fc51e36e06539ea47fd`.

- Four font-contract tests passed after observing three expected failures on the unchanged baseline (run `40169537787`).
- Locked dependency install and Firebase SDK build succeeded; the SDK fingerprint remains `da75c65e901d`.
- Full unit suite: **258 passed / 260 total / 2 failed / 0 skipped**. The only failures are the existing weather-upgrade history tests requiring missing commits `15bb922` and `5a47d5a`. The workflow correctly remains failed overall, not all green. A separate gate matched the exact known failures and rejected any additional failure.
- **250 shared-interface scenarios passed**, errors `[]`: all tabs, all 12 ATPL banks including answer interactions, both themes, 320/390/820/1440 px, native fallback typography, focus/contrast and no page-wide horizontal overflow.
- **18 existing Flight Detail/color/offline scenarios passed**, errors `[]`.
- **12 Weather attention scenarios passed**, errors `[]`: SPECI, TSRA/CB markup, raw-text preservation, saved-label layout and offline/error replacement behavior.
- Browser total: **280 scenarios passed** across hosted Chromium and WebKit. Tests use synthetic guest records, not private production accounts.
- Protected-file diff against baseline passed. The exact tested UTF-8 source bytes were packaged with SHA-256 and byte-length checks, committed as Git objects, and then reviewed before branch promotion.

An initial WebKit offline check read the imported CSS before it had entered the CSSOM. The test now waits for the same revision assertion, blocks external font requests and requires an uncached origin probe to fail; no production workaround or assertion removal was used.

Visual review examined the final light quiz and dark Logbook screenshots. Review was inline; no independent reviewer was available. Hosted Linux browser checks do not validate the actual San Francisco rendering on a physical iPhone/iPad or live Google/cloud sync. Inter downloading from Google Fonts was not required for the offline tests.

## Release safety

The final release commit only adds this report, updates the plan and returns the verification workflow to read-only direct-source testing. The temporary source-transform script and write-scoped candidate job are removed; the application bytes remain those tested above.

Promote to the existing `Pilot-logbook` main branch with an expected-head lease. Keep the existing Railway `pilot-logbook` / `avilog-preview` / `preview` service and `avilog.up.railway.app` hostname. Do not change Variables, Firebase configuration or user records.

After successful deployment, save unfinished input, open online, close/reopen the PWA or reload the page. Do not clear website data or downloaded ATPL banks to obtain the new font.
