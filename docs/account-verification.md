# ATPL account and offline verification

Source: SHA256 `28fbacae42e5b05023c89b077d977e62184a2e916da0dc7d14bd521acd89239f`.
All original question/option/UID/answer JSON and scoring-engine hashes remain unchanged. 6,126 original questions plus the separate 300-question MBR reference = 6,426. Original guest keys and logbook IndexedDB schema are unchanged.

## Reproduce

Use Node >=24.12, JDK 21 and the pinned package-lock.json. No production Google credential is required for emulators.

```sh
npm ci --ignore-scripts
npm run build:atpl-account
npm test
npm run test:rules
npm run test:account-browser
node scripts/verify-atpl-account-storage.cjs
node scripts/verify-atpl-browser.cjs
```

`test:rules` and `test:account-browser` start Auth at 127.0.0.1:9099 and Firestore at 127.0.0.1:8080 using **demo-atpl-sync**. The browser suite enters the actual Auth emulator Google popup, uses the actual bundled Firebase SDK and commits actual Firestore transactions. It never substitutes a mocked progress transport or merely changes the active-UID localStorage key.

Development here uses private, checksum-verified npm 12.2.0 and Temurin JDK 21.0.12.1+1 under ignored `.tooling/`; shared Codex runtime modules were not modified. Production Docker uses Node 24 and `npm ci --omit=dev --ignore-scripts`.

## Recorded checks

- Pure model/storage/controller: independent offline deltas, server-revision conflict order, immutable in-flight retry, local tail rebasing, explicit bookmark removal, report/import deduplication, bounded report batches, reset epochs, imported sessions and resumed UUIDs.
- A new device adopts the current cloud reset epoch. An old queued epoch stays exportable; choosing **Dùng bản trên máy chủ** downloads a standard v2 backup plus recovery envelope before confirmation/replacement. The real-browser suite verifies both recovery and fresh-device restoration after reset.
- A durable acknowledgement cannot erase an answer made meanwhile; later engine saves add only their new work. Remote selection cannot jump an active question. Metadata persistence cannot recursively schedule a new sync.
- Native Chromium/WebKit Web Locks: one bank writer, second tab read-only, owner-close/retry, unsupported locks read-only, separate UID/guest storage and atomic quota failure.
- Real emulator owner rules: positive Google-owner reads/writes; denied other UID, guest, password provider, root/cross-owner lists, invalid code/schema, and mutation/deletion of immutable reports/receipts. A concurrent literal 3/2 + 2/1 + 1/1 fixture converges to 6/4; retry adds nothing.
- Google sessions are checked through the SDK cached-or-refreshed token before opening a cloud transport. Invalid refresh tokens stop sync without clearing the offline namespace.
- Cloud pulls use server-only reads. Memory-cache data after network loss is not sufficient for a successful-sync label.
- HTTP callback proxy: fixed validated Firebase upstream, GET/POST only, 1 MiB request/5 MiB response/15s upstream timeout, restricted redirects, no-store and same-origin framing; ordinary routes retain DENY.
- Service worker: local account modules/SDK precached; optional config cannot block installation; auth/API traffic bypassed; downloaded banks and unrelated caches retained.
- All-bank regression passed on Chromium and WebKit: source-key scoring of all 6,426 questions, offline source images, bookmarks/resume, day/night, export/import, interrupted/quota downloads, SW upgrade and unchanged logbook data.

Machine reports are under `test-results/atpl/Browser_QA.json` and `test-results/atpl-account/report.json`. Chromium uses true offline mode. WebKit uses refused origin/provider connections because [Playwright issue 42775](https://github.com/microsoft/playwright/issues/42775) prevents navigation with its offline flag. The SDK uses official forced long polling after streaming stalled under WebKit. Sanitized WebKit localhost-emulator connection-cancellation diagnostics are retained separately from JavaScript exceptions; functional sync assertions must still pass. Mobile redirect uses a fixed localhost Auth emulator relay sharing the app origin, matching the production helper-proxy design. Its separate mobile context disables SW because emulator helper URLs differ from production `/__/auth/`; production SW auth bypass is tested independently with the real worker. This is not a physical iPad test.

## Production gate

At this document's initial creation, production Google login is **not activated**. Emulator OAuth does not prove real Google OAuth. Before enabling: a user-owned Spark Firebase project, no billing/Analytics, Google provider, exact authorized Railway origin, same-origin auth proxy and deployed owner rules are required. Record actual release/project/location/live-OAuth evidence below before claiming activation.

The user requested `avilog` in the URL, then explicitly chose to keep the old URL until iPad progress is exported. Do not rename the Railway domain yet: origin-local storage and downloads do not move automatically. Navy branding is included independently.

## Independent review correction evidence

The one whole-branch review found no Critical issues, four Important issues and a desktop-iPad routing coverage issue. All five were fixed in one pass with failing regressions first. Final local evidence: 59 Node tests, 12 real emulator rules/transaction tests, complete Chromium/WebKit account browser suites, native storage suites and all-bank offline/source-key grading passed. The updated machine reports include raw UI import validation, preservation of import source, backup bank identity, library Back/lifecycle recovery with actual transport, and desktop-iPad redirect simulation. No code finding was deferred. Real Google OAuth and physical iPad checks are not established by these results.

## Production evidence — 20 October 2026

Published commit `0f920576599fee5b8b3906405463f0d6864c5806`, tree `002419c18782886b42e7c9f69115e9cee96826f0`, exactly matched the tested local tree. All 84 uploaded blobs matched Git hashes; GitHub main updated with an expected-head lease. Railway Docker Node24 deployment `61a28b15-d6e9-44ce-8027-aad7f8c80073` and enabled-config deployment `1ebf905d-eb9c-4d21-9c71-82b135219fc1` succeeded.

Live health, all 12 payload/engine hashes, manifests and sample source images passed. A fresh Chromium context downloaded MB from the public origin, then used true offline mode for a question, source image, answer, bookmark, reload/resume and JSON export; reconnect passed. Public provider SDK initialization reached guest/ready in fresh Chromium and WebKit contexts without page errors. Auth helper HTML and JS returned200 with no-store and same-origin framing.

Dedicated Firebase `avilog-atpl`: Spark without billing/Analytics/Storage; Google-only; Firestore Standard `(default)` in `asia-southeast1`; published owner rules exactly matched the committed text. Both Firebase authorized domain and OAuth web-client origin/redirect handler use the unchanged Railway hostname. OAuth audience is External/In production; no sensitive/restricted scopes configured. Real native Safari consent requested only name/photo/email, returned to the same-origin handler, and Firebase Users confirmed a Google user was created. No user token or private client secret was retrieved. Native Safari automation became unavailable after the popup closed, so the app's real signed-in sync status and cross-device production transfer still require explicit confirmation; they are not inferred from emulator results or user registration. See `ATPL-Live-QA.json` for separate evidence fields.

Build dependency audit retains five high package entries, representing two underlying advisories: the [gRPC server getAuthContext issue](https://github.com/grpc/grpc-node/security/advisories/GHSA-m9gg-hp2v-232j) propagates across four Firebase dependency entries, and the existing [PDF.js scripting issue](https://github.com/mozilla/pdf.js/security/advisories/GHSA-hq66-cqwq-w95j) is one entry. This server does not run gRPC/getAuthContext; browser SDK uses HTTP. The original PDF importer reads core text without viewer/scripting/annotation UI. These path observations narrow exposure; they do not mean the dependency audit is clean. Dependency upgrades remain a separately recorded maintenance item; no forced major downgrade/upgrade was applied during the account release.
