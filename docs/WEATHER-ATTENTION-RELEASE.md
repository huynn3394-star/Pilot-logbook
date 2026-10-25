# AviLog — Weather SPECI, TSRA/CB and compact saved labels

Release prepared 25 October 2026 on the existing AviLog application.

## Requested behavior

- A red SPECI summary appears only at the top of Weather. It scans all saved airport groups, including collapsed groups, and lists each airport once without changing saved ordering.
- Only an observation explicitly beginning with SPECI and matching the airport qualifies. TSRA or CB alone never produces a SPECI alert. A newer ordinary METAR removes the SPECI entry.
- Retained SPECI reports show original issue/retrieval UTC timestamps and explicit offline, refresh-error, stale or uncertain-time labels as applicable. The source supplies the latest retained observation, not a complete history of every SPECI between refreshes.
- TSRA and CB qualify independently. Intensity/recent/vicinity TSRA and cloud suffix CB, including VV005CB, are highlighted in previews and full METAR/SPECI/TAF reports. Existing flight-weather dialogs receive the same escaped markup. VCTS alone and unrelated airport/text substrings are not highlighted.
- Bản lưu sits below the airport identifier in the left column; the report occupies the right column with no extra saved-label row under it. Fresh or absent reports do not create an empty label. A failed refresh keeps the saved label; successful current data removes it.
- Red is an attention exception to the unchanged Navy/Teal design, not a certification of weather severity or operational suitability. Original report bytes and source images are not altered.

## Verification evidence

Base: 073ec63a763e5ef67936aad9f86d37164b1ab025
Tested application commit: b121aaa274feff42f6d03903430e145500ebe1d7
The release documentation commit changes no tested application files.
Run: https://github.com/huynn3394-star/Pilot-logbook/actions/runs/40156550207
Artifact: 12585345727, avilog-weather-attention-checks
Artifact bytes: 4718468
Artifact SHA-256: d27d23da81bd718ab01f3f16fbc1f7ba092d46edf074d70d4c97ba362e505d31

- Locked install and Firebase SDK build succeeded, with unchanged SDK identity.
- Full unit suite: 254 passed / 256 total / 2 failed / 0 skipped. The failures are the pre-existing weather-upgrade tests referencing absent Git commits 15bb922 and 5a47d5a. The overall workflow remains failed; this is not an all-green unit suite. Those tests were not removed or skipped.
- New weather browser verification: 12/12 scenarios, errors []. Chromium and WebKit; 320, 390 and 820 px; light/dark. Checks include top-only alerts, all groups, duplicates, raw text preservation, actual DOM/XSS protection, red contrast, saved-label geometry on ordinary and SPECI rows, replacement, refresh failure and offline reopen.
- Existing Weather UI regression succeeded on both engines, including group editing, source retention, full TAF, offline behavior and cached account isolation.
- Shared-interface report: 250 checks, errors []. Flight-editor/Navy-Teal report: 18/18 checks, errors [].
- Protected-file comparison succeeded: app logic, stored-data models, weather providers, account/SDK source, Firebase rules, dependencies and ATPL original data/media were not changed. Only the Weather view, new presentation helpers/styles, static entrypoint/cache entries, tests and documentation changed.
- Screenshot inspection: Chromium light and WebKit dark at 390px, using synthetic records and a simulated provider failure, confirmed Bản lưu in the left airport column and visible highlights.
- Local TDD: three identity-renderer tests failed before implementation and passed after; a fourth VV005CB case failed then passed with the corrected highlighter. Hosted runs independently exercised the resulting code.

### Test limitations

No production user records or credentials were used. This was not a physical iPhone/iPad test, live weather-provider coverage validation or live Google-account sync test. No independent reviewer was available; the complete scoped diff was reviewed inline.

Runner diagnostics showed Chromium 151 returning navigator.onLine=true after an offline service-worker reload. The verification refuses actual origin connections for both engines, verifies that an uncached API is unreachable, records the browser state and reapplies Chromium offline emulation when required. It never changes navigator.onLine in application code. WebKit uses refused origin connections and explicit refresh to verify retained/error status, not an airplane-mode claim.

## Existing deployment target

Repository main; Railway project pilot-logbook; service avilog-preview; environment preview; domain avilog.up.railway.app. No replacement project, variables or Firebase rules. This document records prepared release evidence; deployment SUCCESS must be verified separately.

To receive the updated shell, save any edits and reopen/reload the app online. Do not clear site storage, Logbook or downloaded ATPL banks.
