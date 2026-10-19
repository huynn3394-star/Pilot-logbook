# Google Accounts and Offline ATPL Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Google registration/login and private cross-device ATPL progress sync while preserving offline learning, existing guest data, original questions/keys and source scoring.

**Architecture:** Firebase Authentication supplies identity; Firestore transactions merge owner-scoped progress using immutable batch receipts. The original engine persists through a namespaced atomic local-storage adapter with a single writer, while public bank/media downloads remain in the existing service-worker cache. Locally bundled SDKs and a fixed same-origin auth proxy support Safari login without making local study depend on network availability.

**Tech Stack:** Development/test Node 24.19.0 (available bundled runtime); production Node 24 LTS, minimum 24.12.0; Firebase JS 13.0.0; @firebase/rules-unit-testing 6.0.0; firebase-tools 15.34.0; esbuild 0.28.2; Playwright 1.62.1; private OpenJDK 21 runtime for emulators. Pin these versions and commit package-lock.json. Keep pdfjs-dist 5.6.205 and tesseract.js 7.0.0 unchanged.

**Spec:** `docs/superpowers/specs/2026-10-20-atpl-google-account-sync-design.md` (approved by user 2026-10-20).

## Global Constraints

- All 6,126 original questions plus the separate 300-question MBR reference retain their source data and scoring behavior.
- Keep source bank-data and engine hashes identical to baseline.
- Keep the original guest keys atpl_<subject>_v2_state unchanged.
- A save either persists both the new state and its sync obligation, or reports failure through the existing unsaved-state UI.
- A remembered UID is only a local cache selector. It grants no cloud permission.
- Only Firebase Authentication plus Firestore rules authorize cloud requests.
- No fallback may silently permit concurrent writers.
- Server acceptance order resolves genuinely concurrent conflicts. Client timestamps are informational only and cannot determine precedence.
- Never silently upload guest/local-HTML progress.
- No promise of new login, downloading missing questions or cross-device transfer without a network connection.
- Logbook, roster and logbook evidence stay in the existing browser IndexedDB; never transmit them.
- Start on Spark, keep billing unlinked; do not create a paid resource or enable Analytics.
- Never substitute an emulator login for proof that real Google OAuth configuration works.
- sources/ is read-only. The immutable input app remains ../output/resolutions-422/ATPL_Trainer_11_Banks_Resolved.html, SHA-256 28fbacae42e5b05023c89b077d977e62184a2e916da0dc7d14bd521acd89239f.

## Review Focus

1. A tab goes into the background during upload, then its account changes before the acknowledgement: old work must remain under the old UID, never leak into the new account (Tasks 2, 4, 6).
2. A backup contains a huge history, invalid counters, an unknown UID or an older bank identity: reject unsafe input before partial replacement, keep the original and offer export (Tasks 1, 5, 6).
3. Two bank tabs race to open on Safari, or Web Locks is unavailable: allow only one writer, otherwise use explicit read-only account mode (Tasks 2, 6).
4. A service-worker upgrade occurs during OAuth redirect or after offline downloads: do not cache auth responses, delete account state or falsely mark an incomplete new bank ready (Tasks 4, 6).
5. A Firestore commit succeeds but the ack or local acknowledgement write fails, followed by new local answers: apply the sent batch once, preserve the tail and never report sync success early (Tasks 1, 2, 3, 6).

## Tóm tắt và cách thực hiện

Thực hiện lần lượt 7 phần: mô hình gộp tiến độ; lưu riêng tài khoản; Firebase/rules; đăng nhập Google; giao diện và nhập dữ liệu cũ; kiểm thử offline hai thiết bị; cấu hình thật và triển khai. Mỗi phần có kiểm thử lỗi trước khi viết mã và kiểm thử toàn bộ sau khi sửa.

Khuyến nghị **Native**: mình trực tiếp thực hiện trong cuộc trò chuyện này, sau đó có một lượt rà soát độc lập toàn bộ thay đổi. Không chia nhiều tác vụ triển khai song song vì các phần dùng chung giao diện dữ liệu.

Bản kế hoạch này cần được người dùng duyệt cùng cách thực hiện trước khi bắt đầu viết mã. Kết nối Firebase có thể được người dùng chuẩn bị trong lúc duyệt; việc tạo dự án/cài thư viện sản phẩm bắt đầu sau bước duyệt này.

## Workspace and commands

Use the existing repo only to read this plan/spec. At execution start inspect attached worktrees, then use using-git-worktrees to create/reuse an isolated checkout based on the commit containing this plan. If the managed tool cannot locate the nested repository, use a Git worktree under the writable ChatGPT project directory on branch codex/atpl-google-sync. Do not work on main or alter sources/.

Initialize the plan-owned execution ledger through executing-plans; record the branch base, exact Node/npm/JDK paths, SDK versions, fixture identities and every interface ruling. No product code/dependency installation/external project creation before plan approval. If npm is not installed, obtain its official CLI from the npm registry into private task tooling; no global installation. Install OpenJDK 21 from an official vendor into private tooling and verify its published checksum. Do not modify the bundled shared node_modules directory. A fresh worktree has its own git-ignored dependencies.

Commands below assume that task-local Node 24/npm and JAVA_HOME are on that command's environment, not global shell configuration:
- npm test: all pure Node/domain/HTTP tests.
- npm run test:rules: real Auth/Firestore emulators using project demo-atpl-sync, then explicit *.emulator.js test files.
- npm run test:account-browser: same emulators plus the actual app/browser account integration suite.
- npm run build:atpl-account: deterministic local esbuild browser output; never a runtime CDN import.

### Task 1: Pure validation, merge and upload lifecycle

**Files:** Create public/atpl/sync/model.js, public/atpl/sync/import.js, tests/atpl-sync-model.test.js, tests/atpl-sync-import.test.js, tests/fixtures/atpl-account.js.

**Interfaces:**
- Consumes normalized engine v2 State, BankIdentity={code,bankSHA256,questions:{[id]:{uid,choices,answer}}}; bank code remains MB or MBR, never interchangeable.
- Produces validateState(state, identity)->State; diffState(base,next,identity)->Delta; applyDelta(remote,delta,revision)->State; prepareBatch(envelope,{batchId,deviceId})->Envelope; acknowledge(envelope,ack)->Envelope; canonicalReportHash(code,report)->Promise<string>.
- Import API: previewImport(account,guest,identity)->Summary; mergeLegacy(account,guest,identity)->State; importHash(code,guest)->Promise<string>. Inputs are cloned, never mutated.
- Envelope v1: uid, code, bankSHA256, epoch, localVersion, state, baseline, cloudRevision, sessionIds:{study,exam}, inflight|null, pendingReports, importReceipts. Batch v1: schemaVersion, uid, code, bankSHA256, epoch, batchId, deviceId, baseRevision, sentLocalVersion, delta, sessions, reports and importIds. Inflight stores that immutable Batch plus sentState. Delta records counters, explicit bookmark add/remove, session changes, per-field settings and report references; no negative attempt/correct deltas.
- Ack: uid, code, bankSHA256, epoch, batchId, cloudRevision, state and acknowledged report/import IDs.

- [ ] **Step 1: Write red tests using hand-checked fixtures.** Two offline devices starting at attempts=3/correct=2 add (2,1) and (1,1); after both accepted, assert attempts=6/correct=4. A repeated receipt leaves those totals at 6/4. An answer after a sent batch remains pending after ack. An explicit bookmark removal is not resurrected by stale state. Clock skew does not override revision order. Separate exam UUIDs remain separate; identical imported reports deduplicate. Epoch mismatch returns a recoverable conflict, not merged counters.
- [ ] **Step 2: Run node --test tests/atpl-sync-model.test.js tests/atpl-sync-import.test.js.** Expected: red because the new public model behavior is missing; correct import/path errors first so tests fail at their behavior assertions.
- [ ] **Step 3: Implement the interfaces.** Validate integer nonnegative bounded counters with correct<=attempts, allowed question IDs/choices and identity. Retain a sent payload unchanged until ack, rebase only the local tail, use later server revision for conflicting fields, and hash canonical reports without volatile export timestamps. Legacy overlapping aggregate counters merge by maxima with correct capped at attempts; do not invent unique old attempts. Limit core/session serialization to 800 KiB; report/batch limits are checked before creating a request.
- [ ] **Step 4: Run the targeted tests and npm test.** Expected: all pass, including rejected malformed/oversize/old-identity imports preserving the input state and an import on two devices producing one import receipt.
- [ ] **Step 5: Commit** feat: add deterministic ATPL progress merge and retry model.

### Task 2: Atomic namespaced storage and single-writer ownership

**Files:** Create public/atpl/sync/store.js, public/atpl/account-bootstrap.js, tests/atpl-account-store.test.js, scripts/verify-atpl-account-storage.cjs.

**Interfaces:**
- Consumes Task 1 Envelope/model.
- Produces openAccountBank({storage,uid,identity,locks,onChange})->Promise<BankStore>; BankStore exposes engineStorage.getItem/setItem, getEnvelope(), beginSession(kind), commitAck(ack), stageImport(state,hash), replaceWithNewEpoch(state), release(), writable and uid. beginSession('study'|'exam') stages a fresh UUID that is persisted atomically with the next successful engine save; it does not modify engine State.
- getItem/setItem accept only the original engine key for that subject. Single atomic setItem writes the account envelope at atpl_account_v1:<uid>:<code>; no account state is written to guest keys.
- Account coordinator exposes getCachedSelection(), selectAuthenticatedUser(user), selectGuest(), subscribe(listener), invalidateGeneration(). Global ATPL_ACCOUNT_READY resolves to the local bank store without waiting for Google/network.

- [ ] **Step 1: Write red unit/browser tests.** Assert account A answer does not modify B or guest keys; quota failure leaves the previous durable envelope byte-for-byte intact; commitAck plus an intervening save preserves the new answer; the second bank tab is read-only; unsupported Web Locks is read-only for account study but leaves guest mode usable. A callback from an old identity generation cannot acknowledge into a new UID.
- [ ] **Step 2: Run node --test tests/atpl-account-store.test.js and node scripts/verify-atpl-account-storage.cjs.** Expected: behavior assertions fail before implementation.
- [ ] **Step 3: Implement the adapter and exclusive Web Lock ownership.** Acquire once before account-bank boot, hold until release/page close, use ifAvailable for other tab views; no homemade expiring localStorage lock. A library sync/import briefly acquires the same lock only if no bank view owns it. Owned bank sync reuses its owner token rather than reacquiring a lock it holds.
- [ ] **Step 4: Run targeted tests plus npm test.** Expected: pass under real Chromium and WebKit localStorage/Web Locks, including atomic-failure behavior and a closed owner allowing the second tab to retry. Do not pretend a Map fixture alone proves browser locking.
- [ ] **Step 5: Commit** feat: isolate account study data and persist pending sync atomically.

### Task 3: Firebase transport, owner rules and real emulator tests

**Files:** Create public/atpl/sync/firebase-transport.js, firebase/firestore.rules, firebase/firestore.indexes.json, firebase.json, tests/firebase-rules.emulator.js, tests/atpl-firestore-sync.emulator.js, scripts/atpl-emulators.cjs; modify package.json, create package-lock.json; update Dockerfile to Node 24 and npm ci --omit=dev --ignore-scripts.

**Interfaces:**
- Consumes Task 1 Batch/Ack and Task 2 BankStore.
- Produces createProgressTransport({db,uid,identity,getAuthGeneration})->{pull(),commit(batch),subscribe(onRemote),close()}. It accepts only its constructor UID/identity and checks generation before applying responses.
- Core path users/<uid>/banks/<code>; subcollections sessions/<sessionId>, exams/<reportHash>, receipts/<batchId>, imports/<importHash>. Core: schemaVersion=1, epoch, revision, bankSHA256 and engine-compatible core excluding unbounded examHistory; history is reconstructed from immutable report documents.
- A transaction reads all needed documents before writing, returns current state for an existing receipt, and atomically applies a new delta plus receipt. Keep a transaction at <=20 report documents and <8 MiB total request; size-limit failures retain the outbox.

- [ ] **Step 1: Pin/install the exact SDK/test versions from Tech Stack into the isolated checkout.** Add explicit test:rules and test:account-browser scripts; use demo-atpl-sync with localhost auth:9099/firestore:8080, no production credential. Install private official JDK 21 if missing. This setup belongs to the deliverable's emulator test cycle, not a separate feature.
- [ ] **Step 2: Write red rules and transaction tests.** assertSucceeds for owner reads/writes; assertFails for A reading/writing B, guest access, cross-owner collection lists, invalid code/schema and overwriting an immutable report/receipt. An actual concurrent commit from A1/A2 yields 6/4 from Task 1's literal fixture; retry/lost ack adds nothing; different session UUIDs and report hashes survive.
- [ ] **Step 3: Run npm run test:rules.** Expected: failures at missing owner/transaction behavior. Use the real emulator and SDK, not a fake transport whose return values mirror expected results.
- [ ] **Step 4: Implement locked-down rules and transport.** No public wildcard, server SDK credential or test mode. Require auth.uid==path UID and a Google-authenticated identity, enforce schema/types/immutable fields and bank allowlist. Reject stale epoch. Keep Firestore memory-only; local durability stays in BankStore. Stop subscriptions on logout. Do not transmit logbook data.
- [ ] **Step 5: Run npm run test:rules and npm test.** Expected: both green; rule denials proven independently with two users and unauthenticated context, no test-only trust path in production.
- [ ] **Step 6: Commit** feat: add private Firestore sync with idempotent transaction receipts.

### Task 4: Google provider, local SDK build and same-origin auth proxy

**Files:** Create public/atpl/account.js, public/atpl/firebase-client.js, scripts/build-atpl-account.mjs, lib/firebase-auth.js, tests/firebase-auth-http.test.js; create built public/atpl/vendor/ files and public/atpl/privacy.html; modify server.js, package scripts and .env.example.

**Interfaces:**
- Public runtime config GET /atpl/firebase-config.json: {enabled,appOrigin,projectId,apiKey,authDomain,appId,emulators?}; disabled-by-default, no secrets. Emulator fields allowed only for localhost in explicit test config.
- createAccountClient({config,coordinator})->{ready,login(),logout(),subscribe(listener),currentUser()}; uses Firebase Auth local persistence and GoogleAuthProvider only.
- createFirebaseAuthHandler({config,fetchImpl})->async(req,res,url):boolean. Fixed upstream https://<validated-projectId>.firebaseapp.com for /__/auth/; does not accept a target URL from the request.
- build:atpl-account produces a deterministic same-origin bundle/manifest; dynamic import graph is fully vendored and no production module fetches Firebase JS from a CDN.

- [ ] **Step 1: Write red HTTP/provider-boundary tests.** Disabled config exposes no active login; malformed host/project is rejected; arbitrary target/query traversal cannot change upstream; /__/auth GET/POST work with bounded bodies, other methods are refused; callbacks are no-store and same-origin embeddable, while normal routes retain framing protection. An expired/failed auth result cannot create a signed-in account. Local-only bootstrap must resolve with all provider network requests unavailable.
- [ ] **Step 2: Run node --test tests/firebase-auth-http.test.js and npm run test:rules.** Expected: new behavior red; preserve existing weather/HTTP tests.
- [ ] **Step 3: Implement validated config/provider and strict proxy.** authDomain matches current app origin, redirect uses /__/auth/handler, forward documented helper requests transparently with manual redirects, omit hop-by-hop headers, cap request body at 1 MiB/response at 5 MiB and upstream time at 15 seconds. Do not set global X-Frame-Options DENY on the helper frame; restrict that route to same-origin embedding. Auth callbacks, ID tokens and provider errors never enter logs or SW cache.
- [ ] **Step 4: Build the bundled SDK, run targeted tests and npm test.** Expected: repeat builds have identical outputs; no external script import; all existing HTTP and logbook-domain tests pass on Node 24.
- [ ] **Step 5: Commit** feat: add Google account provider and Safari-compatible auth endpoints.

### Task 5: Account UI, legacy import and original-engine integration

**Files:** Create public/atpl/account-ui.js, public/atpl/sync/controller.js; modify public/atpl/index.html, catalog-ui.js, bank-bridge.js, atpl.css, scripts/package-atpl.py; generate public/atpl/identities.json plus new bank/manifests/catalog. Create tests/atpl-account-controller.test.js; extend tests/atpl.test.js.

**Interfaces:**
- createSyncController({account,openBank,transportFactory,onStatus})->{syncNow(code?),stop(),status()}; only the active UID generation's lock-owning store may persist acknowledgements.
- mountAccountUI({element,account,controller,coordinator}): library/bank controls for login, identity, sync, logout, migration preview and reviewed reset/import. Status separates durable-local, pending, offline, reauth, error and fully acknowledged.
- New engine-adjacent bridge ATPLAccountBridge exposes refreshAtSafeBoundary(state), beginSession(kind), beforeImport(state,mode), beforeReset(state) and onLocalSave(state). Call beginSession before the UI starts a new study/exam; resume/move/answer retain the existing sidecar session UUID. Original source engine remains byte-identical.
- identities.json is generated only from immutable bank-data: code, bankSHA256 and {id,uid,choices,answer} for valid source questions; never synthesize missing IDs/keys.

- [ ] **Step 1: Write red controller/packaging tests.** Authentication alone does not upload guest keys. Declining import changes nothing. Accepting the same backup on two devices imports once. Partial report upload keeps status pending; quota/auth/identity-switch never says synced. Reset creates an explicit epoch; an old epoch remains exportable. Imported unsupported/oversize data cannot partially overwrite an account. Source JSON, valid counts and scoring-engine hashes remain identical to baseline.
- [ ] **Step 2: Run node --test tests/atpl-account-controller.test.js tests/atpl.test.js and npm test.** Expected: account behavior red while baseline source checks remain green.
- [ ] **Step 3: Implement UI/controller.** Debounce online sync by 2 seconds, retry transient failures with bounded exponential backoff, offer sync-now and last-ack time. Do not claim closed-iOS-app background sync. Parse legacy data with the original engine validators; preview maxima-based legacy counter merge. Keep an explicit original backup/download and original guest keys.
- [ ] **Step 4: Patch packaging at precise asserted insertion points.** Add cached bootstrap before the UI; await local readiness in the UI wrapper, select adapter at the existing localStorage assignment, and refresh remote changes only at a safe boundary. Route account backup import and reset through reviewed operations instead of silently interpreting reduced counters. Do not alter engine, bank data or source media bytes. Recompute HTML URLs and manifests; preserve existing images and pack files when media bytes have not changed.
- [ ] **Step 5: Run build:atpl-account, package-atpl.py with the pinned input, npm test and npm run test:rules.** Expected: all green; 12 bank identities match source metadata, every key/UID/options/hash/count retained, logbook IndexedDB/schema untouched.
- [ ] **Step 6: Commit** feat: connect Google accounts and progress sync to all ATPL banks.

### Task 6: Offline cache, two-device browser QA and release regression

**Files:** Modify public/sw.js, scripts/verify-atpl-browser.cjs; create scripts/verify-atpl-account-browser.cjs, tests/atpl-service-worker.test.js and docs/account-verification.md.

**Interfaces:** Consumes Tasks 2-5 and real demo-atpl-sync emulators. Browser fixture launches actual createServer with localhost-only public emulator config and two independent browser contexts. Output records engine/browser versions, test mode and real outcomes under test-results/atpl-account/.

- [ ] **Step 1: Add red browser/SW tests.** Download MB, answer/bookmark on context A with network disabled, reload source image and resume, reconnect, wait for actual ack, then read on context B under same Google emulator UID. B's own separate UID must see no A progress. Repeat answer/reconnect/lost-ack with new local work; use literal counts. Logout/account-switch with an open bank tab blocks new writes to the previous UID. Two tabs racing permit one writer; unsupported Web Locks is read-only, not an unlocked writer. SW upgrade during cached bank use retains downloads and cannot cache OAuth traffic.
- [ ] **Step 2: Run npm run test:account-browser and the SW test.** Expected: failures pin the missing cache/integration behavior; no account test passes by merely setting localStorage identity or mocking the app's transport.
- [ ] **Step 3: Update SW.** Preserve avilog-atpl-v1 and unrelated caches, precache all required account/vendor files and public config, bypass /__/auth/, keep /api/ uncached, and keep SHA-verified per-bank readiness. Config/provider failure must not poison app-shell installation or disable guest/offline learning.
- [ ] **Step 4: Run npm test, npm run test:rules, npm run test:account-browser and node scripts/verify-atpl-browser.cjs.** Expected: all green. Chromium uses true context offline mode; WebKit uses refused origin/provider connections because of Playwright issue 42775, explicitly recorded. All 6,426 source-key questions grade correctly, source images open, legacy export/import and logbook data remain intact. Verify layouts at 390x844 and 1024x1366.
- [ ] **Step 5: Commit** test: verify private two-device sync and offline ATPL regression.

### Task 7: Independent review, provider setup and live deployment

**Files:** Modify README.md, docs/account-verification.md; keep actual environment identifiers/secrets out of Git except intentionally public Firebase web config. Write deployment/live-QA records into the project's output/pilot-logbook-google-sync/ directory.

**Interfaces:** Consumes committed green branch, versioned rules/indexes and exact generated artifacts. Provider ownership is the user's Google account; Railway remains huynn3394-star/Pilot-logbook at https://avilog-preview-preview.up.railway.app.

- [ ] **Step 1: Complete the plan ledger and request one independent whole-branch review under executing-plans/requesting-code-review.** Include source immutability, Review Focus and interface rulings. Expected: no unfixed Critical/Important finding. Fix such findings in one RED-GREEN/full-suite pass; report deferred minors and rulings.
- [ ] **Step 2: Configure the user's dedicated Firebase project through the confirmed Firebase plugin.** If not connected, finish unaffected code/tests and provide the exact connection/setup step; do not claim activation. Use Spark without billing/Analytics, Google provider only, a supported nearby Firestore region, locked rules/indexes and the exact production Railway authorized domain and redirect handler. Record selected project/app/database location in release evidence. Any terms acceptance, Google verification or sensitive new access the browser requires is handed to the user at that concrete step.
- [ ] **Step 3: Confirm readiness to deploy with defaults disabled.** Expected: node/emulator/browser suites green, original payload/engine hashes unchanged, no secret/private token in Git or logs, guest backups available and generated runtime config exposes only public fields. Publish a concise privacy notice/setup/recovery guide; keep logbook unchanged.
- [ ] **Step 4: Publish the reviewed branch through the authenticated GitHub connection with an expected-head lease.** If CLI cannot push, upload only changed text/generated files, verify each Git blob SHA, verify remote tree against local tree, create commit and update main without force. Do not re-upload unchanged 330 MB image packs. Account for spec/plan documentation commits based on the last published head b698e8775ac13a7545285e9b122434af3585fc9a.
- [ ] **Step 5: Deploy/configure Railway with validated Firebase environment and run live checks.** Expected: successful exact commit, /api/health healthy, all bank payload/engine hashes correct, real Google login and A-to-B sync on the production origin. Use emulator checks as additional evidence, never as proof of real OAuth. Ask the user to complete Google verification only if needed. Report physical iPad testing only if actually performed.
- [ ] **Step 6: Test production-origin offline study and reconnect sync, then declare activation.** If live OAuth/rules fail, disable account sync while preserving downloads, guest state and private unsent work. Deliver the live link, the phone-to-iPad workflow, offline limitations, verification report and any remaining provider-specific blocker. Do not leave a nonfunctional Google button advertised as complete.
- [ ] **Step 7: Commit documentation/evidence needed in the repo and finish the development branch through the required skill.** Keep user-facing instructions in Vietnamese and final output concise.

## Self-review and execution handoff

Coverage: spec sections 1-2 -> all tasks; 3 -> Task 4; 4-5 -> Task 2 and Task 6; 6-7 -> Tasks 1/3; 8 -> Tasks 1/5; 9 -> Task 6; 10 -> Tasks 3/4/7; 11 -> Tasks 2-6; 12 -> Tasks 6/7; references remain in the approved spec.

Interface checks: state/identity/Delta/Envelope/Batch/Ack names are shared across Tasks 1-3; stores remain synchronous after local readiness; only lock owners drive writes; controller generation prevents cross-account callbacks; report receipts and import receipts are independent of unbounded history; cache completeness and cloud acknowledgement are separate statuses.

Execution method is pending user selection. Recommended Native: implement the tasks in this session with the ledger, then one independent whole-branch review. Subagent-driven is available if the user prefers a fresh implementer/reviewer gate for each task. Neither begins before plan review.

