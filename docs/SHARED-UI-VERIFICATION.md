# AviLog — Shared Interface, 25 October 2026

## Approved scope and implementation

Standardize presentation across Schedule, Logbook, Crew, Statistics, Weather, Settings, the ATPL library and all quiz banks. Retain the navy brand, one teal accent, the compact flight editor, specialist calendar/weather/quiz layouts and existing data behavior.

- `public/ui/tokens.css` supplies one palette, typography stack, spacing scale and control/card sizes, including light/dark values. Navy stays `#142744`; teal is `#0f766e` on light surfaces and `#2dd4bf` on dark surfaces.
- `public/ui/system.css` adapts the existing screens to shared headings, navy toolbars, controls, menus, cards, notices, dialogs and readable input styles. Standard buttons have a 44px minimum height; specialist calendar cells, question navigators and UTC inputs retain their own geometry.
- Main and ATPL library entrypoints load the shared system. Quiz banks receive the same system through the existing external bank-theme bridge, without rewriting immutable bank HTML or their manifests. The library management menu is grouped in its toolbar.
- Source illustrations and evidence images are not recolored. Correct/incorrect answers retain distinct text/outline cues; actual error states may use red rather than pretending every state is successful.
- Both shared stylesheets are precached in `avilog-shell-v14-fast-entry-navy-teal-unified-sdk-<bundle hash>`. User databases and independent ATPL/OCR caches are not reset.

## Verified revisions

Baseline: `8a17e4908fbe54783fbe92b047ff2422c87ce1fe`.
Tested head: `450d3dd875d26767e04fa5822f0658e1839cdb7d`.
The release documentation commit adds no application or test changes after this verified head.

GitHub Actions: https://github.com/huynn3394-star/Pilot-logbook/actions/runs/40147997252
Artifact: https://github.com/huynn3394-star/Pilot-logbook/actions/runs/40147997252/artifacts/12582155033
Artifact contains 57 screenshots/reports/logs, 3915416 bytes. GitHub reported SHA-256 `66602e0421eb246d928975e2ed9320939c3b2a170a3918167276ab0481e54839`.

## Fresh test results

- Locked dependency install and account SDK build succeeded on Node 24.12.0. SDK build marker remains `da75c65e901d`.
- Unit suite: **237 passed / 239 total / 2 failed**. The failures are the pre-existing weather migration tests requiring missing Git objects `15bb922` and `5a47d5a`. They remain intact, and the overall workflow is correctly red. This is not a claim that every project test passes.
- **250/250 shared-interface scenarios passed**, errors `[]`: Chromium and WebKit, 320/390/820/1440px, light/dark, six main tabs, Flight editor, ATPL library, all 12 banks and their answer screens on phone, representative bank coverage at other widths, quiz settings dialogs and main/library offline reload. Checks inspect actual application surfaces, navy toolbars, shared font/radius/background, token contrast and horizontal overflow. The weather empty state is the real UI, not an injected fake card. Opening the existing collapsed bank management menu is part of the test.
- **18/18 existing navy-teal regression scenarios passed**, covering Flight editor colors, focus, tab switching without losing fields, responsive layouts and installed offline styles.
- `scripts/verify-atpl-browser.cjs` succeeded unchanged: both browser engines downloaded and reopened all banks offline; retained original-key scoring and backup restoration; exercised actual answer controls, bookmarks, theme changes and source-image dialogs; checked cancellation, HTTP failure, corrupt/missing-asset repair, storage-quota errors, service-worker upgrades and unchanged guest Logbook state.
- Protected-file comparison against the baseline exited successfully: no changes to `public/app.js`, `public/lib/`, `public/workspace/`, `public/account/`, bank HTML/manifests/catalog/identities, original data, backend modules, `server.js`, Firebase rules, package manifest or lockfile.
- The two shared-style consumption/precache tests were first run against the old interface and failed as intended (run `40146724569`). They now pass. No existing tests were removed or skipped to turn failures green.

## Review and limitations

The source diff was reviewed inline; no independent reviewer agent was available. Browser screenshots were produced by CI, but this session did not independently render the downloaded screenshot archive. Automated layout/color checks and functional browser tests are the evidence above, not a claim of pixel-by-pixel visual approval.

These are isolated guest/demo sessions against a local server on the hosted runner. No production account or user record was used. They do not establish physical iPhone/iPad behavior, live Google OAuth or live multi-device cloud synchronization. External fonts are blocked in the shared-interface test, so the common fallback stack is used when unavailable. WebKit offline verification refuses origin connections; it is not an iOS airplane-mode test.

Existing dependency advisories and the two missing-history migration fixtures are outside this presentation change. Dependencies, Firebase settings and rules were not changed to address them.

## Release target and update behavior

Use the existing repository's `main` branch and Railway service `avilog-preview`, project `pilot-logbook`, environment `preview`, domain `avilog.up.railway.app`. No replacement project, new hostname, data migration or variable change is required. Check the actual deployment status separately before announcing that it is live.

Save any open form, open the app online and then close/reopen old tabs or the PWA to receive the new shell. Do not clear website data, IndexedDB, logbook records or downloaded banks. A rollback must retain the V14-capable application, not downgrade to an older schema.
