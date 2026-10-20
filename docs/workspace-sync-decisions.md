# AviLog whole-app sync decisions

Implementation decision record. Production activation is pending final verification; emulator and desktop browser results do not certify a physical iPad.

## Rulings (chronological)

- Ruling: Native managed tool returned Not a git repository for nested repo; use approved Git worktree fallback under project/worktrees/avilog-whole-app-sync — keeps main untouched — cost if wrong: manual worktree lifecycle instead of app attachment.

- Ruling: User weather amendment extends flight data with text weather group, not image evidence or a new service — retain raw METAR/TAF/source/fetchedAt for only departure/arrival and UTC flight day; auto-save when app open on that day, refresh explicit, never label today's latest as historical weather for an old/future flight — cost if wrong: timing preference may need UI adjustment, stored raw text remains recoverable. NOAA API verified raw products/current-query behavior from https://aviationweather.gov/data/api/; source snapshots identify retrieval time, not exact conditions at OUT/IN.

- Task 2: Ruling: persist original image bytes as ArrayBuffer + MIME, recreate Blob at API boundary — WebKit native IDB Blob aborted/retried with UnknownError Error preparing Blob/File data; raw-byte persistence passed both engines — cost if wrong: one extra in-memory Blob/byte conversion; no compression or image change.

- Task 3: Ruling: precache the two moved shared modules now and preserve immutable bank/media cache fallback on network-failed reload, instead of waiting for Task 9 — cold first-open test and reload unit reproduced failure; user requires offline throughout — cost if wrong: earlier SW change; HTTP failures still remain failures and source hashes stay fixed. Cold test waits the ✓ ready marker, not substring matching the interim not-ready line. Removing shared precache paths individually reproduces RED; restore passes grading all 300 MB keys.

- Task 3: Ruling: classify native WebKit config diagnostics as cancellations only when the same page/origin/path has a recorded cancelled request or deliberate test socket refusal within 2 seconds — WebKit emits native access-control pageerror despite caught cancellation; all functional assertions remain strict — cost if wrong: test-only diagnostic categorization. Unrelated/stale/CORS-only errors fail the independent classifier test; no production error suppression. Rules 12/12 and SDK browser full Chromium151/WebKit26.5 passed with errors=[], realGoogleOAuth=false, physical iPad not tested.

- Task 4: Ruling: allow the workspace root update to retain its current revision only for Firestore retry preconditions, as in the existing ATPL rules; the transport always advances it by one — a concurrent transaction must reach the SDK retry rather than fail its rule precondition — cost if wrong: a malicious owner could perform a no-op root write in their own workspace.

- Task 4: Ruling: extract stable pagination into pull.js and exercise it using real SDK page reads plus a second authenticated writer — deterministic interleaving without production-only pause hooks — cost if wrong: one additional module boundary. Import markers include recordKeys so a repeated part cannot be silently applied to different rows.

- Task 5: Ruling: recover unknown receipts before treating local predictive conflicts as authoritative, and block causal work per record rather than per multi-record operation — a lost accepted receipt and independent fields must not be stranded — cost if wrong: an already-conflicted mixed operation may receive another immutable conflict result while its independent records proceed.

- Task 7: Ruling: use deterministic groups of at most three domain records for import receipts, and wait for all selected records of an incomplete group before staging it — three worst-case 128 KiB base+next pairs fit below 800 KiB independently of device parents, stable positions allow multipart resume — cost if wrong: more Firestore transactions for large imports than an adaptive eight-record partition.

- Task 7: Ruling: multipart export makes bounded passes over pinned image bytes (validation, payload hashes, then emission), with one part in memory and a repeated manifest — hashes cannot include themselves or require retaining all images — cost if wrong: extra local reads/CPU and repeated manifest bytes. Supplied original parts are saved to recovery before any restore operation; images imported into another account start cloudReady=false.

- Task 8: Ruling: freeze the displayed view while a modal/settings draft is open, while allowing the Session/repository to accept remote updates; save diffs against the captured base and refresh the displayed view after closing — otherwise a background render could erase form input or make unrelated remote fields look like user edits — cost if wrong: another device's changes become visible after the active form closes. Async OCR/PDF/image/legacy-file callbacks additionally hold both UID/generation and modal context.

- Task 9: Ruling: serve the installed versioned static shell cache-first, while optional public config stays network-first — mixing newly fetched modules with an old installed graph can break cold offline startup — cost if wrong: every public shell change must bump the shell version to reach existing installations.

- Task 9: Ruling: upgrade QA waits for both the actual controlling worker version response and activation cache cleanup before removing network — a new cache name exists during installation and is insufficient readiness evidence; the tiny version response exposes only the public shell version — cost if wrong: extra readiness handshake in the test, no account data broadcast.

- Task 9: Ruling: retain bounded timestamp history for exact WebKit intentionally refused config requests in the test harness — a later request overwrote proof of the earlier diagnostic, producing a false failure — cost if wrong: a precisely matched native network diagnostic within two seconds could be classified; unrelated page errors remain failures. WebKit offline upgrade uses the established server-origin-refusal fixture because Playwright WebKit offline mode rejects even service-worker navigations; no physical iPad claim.

- Task 10: Ruling: acceptance combines real main UI parser/file callbacks with production Session/controller/backup UI on a neutral page for deterministic transport/ack/image boundaries — main UI owns the writer lock, so a second test writer would be invalid — cost if wrong: full-suite coverage is spread across named runners rather than one monolithic UI script; production Google/iPad remains a separate gate.

- Task 10: Ruling: classify WebKit native Firestore CORS diagnostics only when the exact emulator request was intentionally aborted in this context within two seconds — actual network refusal is the offline mechanism; all unrelated exceptions fail — cost if wrong: one precisely matched native network diagnostic is classified, never a sync validation error. Regression RED→GREEN for absent/wrong-page/wrong-URL/stale proof.

- Task 10: completion run reached the WebKit parser-race fixture and failed because SW-controlled WebKit requests bypassed the route holding the synthetic PDF parser, so the real parser rejected the deliberately non-PDF boundary bytes. Ruling: block service workers only in online parser-boundary fixture contexts — offline/SW coverage runs separately with real workers — cost if wrong: these three held-parser race scenarios do not simultaneously exercise SW. Targeted WebKit PDF/OCR/attachment races now GREEN. All-stage command reruns after the fixture correction; no app code weakened.

- Task 11 provider preparation: user confirmed Firebase Payment and 5 USD/month warning. Ruling: account currency is VND, so configure 130,000 VND/month (~5 USD, Wise live mid-market quote ~25,880 VND/USD checked 2026-10-20) — Google budget form accepts only billing currency — cost if wrong: fixed VND alert differs slightly from future USD conversion; alert is not a cap. Google Console visibly confirmed Plan change completed successfully / Blaze after linking the selected existing account; no new card, credential, agreement, Analytics or Gemini was added. Storage bucket/rules/CORS still pending. Fresh runtime audit reports five high package entries with three underlying advisories: two gRPC server-only advisories and PDF.js scripting; exposure assessment goes in final review, no forced dependency downgrade.

- Task 10: Ruling: WebKit navigation cancels an existing Firestore Listen SID and then reports CORS-shaped diagnostics for retries of that same channel; requestfailed evidence shows cancelled for the identical SID/database/page within milliseconds. Classify only that channel within two seconds, plus exact intentional route aborts; negative regression rejects different SID/database/page/port/time or actual CORS failure — cost if wrong: a concurrent error on the same just-cancelled emulator SID could be classified. Earlier exact-URL-only proof correctly failed. Discarded same-origin relay and native WebKit offline Blob NotReadable fixtures were not accepted as release evidence; preinstalled route cuts now assert all three provider probes fail. No production error filtering was added.

- Task 11: in progress BASE 12d18831bb44e0473479d1df556e386b059cc7a9; brief read. Ruling: begin read-only whole-branch review and release documentation while Task10's final twelve-stage verification continues — production implementation is frozen, targeted engine acceptance is green and this overlaps independent work without publishing — cost if wrong: any later important defect must enter the one test-proven fix pass; no merge/activation gate is waived. Single fresh reviewer final_workspace_review dispatched on gpt-6-astra high, no implementer agents, range03a64b2..7980302, template/plan/spec/five Review Focus/ledger/advisories provided. No production app published.

- Final: Ruling: real Google OAuth and exact production rules/domain/CORS remain release gates outside read-only review — do not activate or claim them based on emulators — cost if wrong: deployment remains unavailable until actual checks pass.

- Final: Ruling: desktop WebKit/viewport coverage does not prove physical iPad/iPhone behavior — require separate user evidence — cost if wrong: platform-specific device issues can remain until manual test.

- Final: Ruling: billing/account ownership was checked by executor/provider UI, not independently by reviewer; actual future costs are not inferred from emulator reads — retain alerts-only budget and no cost-cap claim — cost if wrong: usage may incur charges beyond the warning.

- Final: Ruling: authenticated owners may deliberately bypass business merge rules in their own namespace; enforce cross-UID isolation and correct official-client behavior — within the spec's security boundary — cost if wrong: custom clients can corrupt their own records.

- Final: Ruling: scale evidence covers pagination/native persistence/duty operations, not10000-flight backup restore/import throughput — publish only measured workload — cost if wrong: large imports may be slower or need further optimization.

- Final: Ruling: audit findings have no demonstrated reachable server/scripting path in this app; keep pinned versions for this release and track compatible patched upgrades; isEvalSupported:false alone is not the PDF scripting advisory mitigation — cost if wrong: an unrecognized dependency exposure remains until upgrade or further analysis.

- Final: Ruling: persist restore progress keyed by full validated backup-set identity and target UID in the existing recoveries store, atomically with each local domain/blob save — this allows image-only continuation without recreating queued metadata and rejects changed records/unrelated edits — cost if wrong: progress metadata and retained source parts consume additional local space. Image continuation loads one verified image at a time, not the whole photo collection. Completion still requires all validated parts/images and expected records.

## Provider preparation

Existing Firebase project avilog-atpl; default bucket avilog-atpl.firebasestorage.app in asia-southeast1. Blaze selected using the user-approved existing billing account. Alerts-only project budget: 130,000 VND/month (approximately USD 5 at configuration time); email thresholds 50%, 90%, 100%. This is not a spending cap. Storage remains deny-all and feature flags remain disabled until release gates pass. Automatic approval review rejected saving CORS for the old preview hostname: exact target authorization was missing and the requested new AviLog hostname was not yet verified. No CORS policy was saved; do not bypass this via another tool. Finish unaffected work and obtain approval for the concrete owned origin. No public image access, credential rotation or automatic upload of guest data.

## Runtime advisories

The pinned runtime audit reports five high package entries representing three advisories: gRPC getAuthContext certificate handling (GHSA-m9gg-hp2v-232j), gRPC server-handler error exposure (GHSA-f596-whhp-79r4, low advisory propagated through affected packages), and PDF.js scripting (GHSA-hq66-cqwq-w95j). The server does not run a gRPC server; browser Firebase uses HTTP. PDF import uses core getDocument/getTextContent with isEvalSupported:false and no viewer/scripting UI. Final independent review must assess exposure; this is not a clean-audit claim.

## Rollback

Disable workspace/evidence flags independently while keeping the account-namespaced build. Preserve IndexedDB, pending operations, original blobs, recovery files, cloud records and ATPL cache. Do not roll back to the old shared guest store, delete buckets or disable billing for the whole project.

## Origin change

The latest user request authorizes renaming to avilog. Claim and verify the actual Railway domain before configuring it in OAuth/Firebase/CORS. A new origin cannot read the old origin’s local browser data; same-account cloud records can return after login, while unsynced/guest data needs backup/import and offline assets must be downloaded again.

## Deferred minors

Cloud-only evidence viewing currently requires Settings → download all rather than a per-photo on-view download. This is deferred; original bytes remain available through the authenticated bulk-download path.

## Independent review and fixes

One fresh independent review found no Critical issue and three Important issues. All three were reproduced before fixing: full backup omitted acknowledged/resolved conflict originals; background image/weather writes left a stale synced label; offline multipart image-only continuation could not resume queued metadata. Native Chromium/WebKit now verify retained originals, strict missing-byte rejection, automatic metadata commits and status invalidation, durable restore progress, quota rollback, image-only continuation and stable queued operation IDs. Final completion suite: all 12 stages, 131 Node tests, legacy/workspace/evidence rule suites 12/14/4, all 6,426 source questions and both browser engines passed. Production Google/OAuth/CORS and physical devices remain separate gates.


## Live validation update — 20 October 2026

The human subsequently approved only https://avilog.up.railway.app. Railway confirmed and renamed the service domain to that exact hostname. Existing OAuth origin/callback and Firebase authorized domain now match; the released preview authorized domain was removed. Firestore/Storage published rule text was copied back and matched tested source. CORS Save succeeded for only the approved new origin; real provider OPTIONS confirms it and denies unrelated origins. Anonymous Firestore/Storage return HTTP 403. This resolves the earlier old-preview CORS approval block without bypass. Both flags are on for live validation, not a claim that all gates passed. No guest data was auto-imported.

- Ruling: native Safari observation disconnects after Google popup closure; accept the human email-visible confirmation as real OAuth evidence only, then require separate live sync evidence — login does not prove sync — cost if wrong: reproduce login on the physical device before final activation.

The user then confirmed TEST SYNC Crew appeared on the iPad with synced status, proving an actual owner SDK metadata write and independent-device pull through the app. Original image/offline/reconnect checks remain pending. Budget and all previously recorded rulings still apply.
