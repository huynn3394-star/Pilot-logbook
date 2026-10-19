# ATPL: Google accounts and offline progress sync

Date: 2026-10-20 (Asia/Saigon)  
Status: written specification for user review; implementation has not started.  
Baseline: Pilot Logbook commit `b698e8775ac13a7545285e9b122434af3585fc9a`.

## Tóm tắt để duyệt

- Thêm **Tiếp tục với Google** trong phần Ôn thi. Lần đăng nhập đầu tạo tài khoản; chỉ dùng danh tính Google, không xin quyền đọc Gmail.
- Điện thoại và iPad dùng cùng tài khoản nhận cùng tiến độ sau khi đồng bộ. Hiển thị **Đã đồng bộ**, **Còn thay đổi chờ gửi**, **Offline** hoặc **Cần đăng nhập lại**.
- Mất mạng vẫn học các môn đã tải. Tiến độ được lưu tại máy trước, gửi khi có mạng và phiên đăng nhập còn hợp lệ. Đăng nhập lần đầu và chuyển tài khoản cần mạng.
- Tài khoản A và B có kho tiến độ riêng. Chế độ khách vẫn dùng được. Đăng xuất đưa về kho khách, không đưa tiến độ tài khoản vào kho khách.
- Trước khi đưa tiến độ cũ trên máy vào tài khoản, app cho xem tóm tắt và hỏi xác nhận. Bản cũ vẫn được giữ để xuất sao lưu.
- Giữ nguyên câu hỏi, UID, lựa chọn, đáp án gốc và bộ máy chấm thi. MB và MBR tiếp tục riêng.
- Chỉ đồng bộ phần ôn thi ATPL trong đợt này. Logbook, roster, giấy tờ/ảnh bằng chứng của logbook và IndexedDB hiện tại không được gửi lên Firebase.
- Dùng Firebase Authentication và Firestore, khởi đầu với gói Spark không liên kết thanh toán. Nếu hết hạn mức, tiến độ giữ ở máy và báo đang chờ; không tự nâng lên gói trả phí.

## 1. Intent, scope and acceptance

The user wants Google/Gmail registration so the app recognizes the same person across a phone and iPad, while different people retain separate study records. Offline study and the original answer keys are existing requirements.

Success means:
1. A first Google login creates an identity; later Google logins restore the same Firebase UID, independent of browser/device.
2. After device A reports a successful sync, device B using the same account can fetch those question statistics, bookmarks, exam history and resumable sessions.
3. Both devices can make offline changes, reconnect and converge without losing acknowledged attempts or duplicating a retried upload.
4. A different account cannot read or write the first account's cloud documents, including by changing document paths or client profile identifiers.
5. Google/provider/database failure cannot prevent opening a downloaded bank or corrupt local study state.
6. All 6,126 original questions plus the separate 300-question MBR reference retain their source data and scoring behavior.

Excluded: logbook sync, passwords/email-code registration, payments, rankings, instructor roles, sharing progress with other users, cloud question/media storage, background sync while iOS has closed the app, and changing any audit conclusion.

## 2. Current system and selected approach

The live Node HTTP server is stateless and serves the static trainer through Railway. The 12 bank pages include an unchanged ATPL state engine. Their UI saves a whole v2 study state to localStorage through `E.load/E.save`. A service worker caches public assets and explicit bank downloads; logbook state resides in a separate IndexedDB database.

Selected: Firebase Authentication with the Google provider, plus owner-restricted Firestore progress documents. Railway continues hosting all app/question/media content. No new Railway database service is needed.

Alternative considered: Google OpenID Connect on Node with a new persistent database and server sessions. It fits the existing server but adds database/session operation and credential handling. The user approved the managed Firebase approach. Firebase built-in whole-document last-write-wins is insufficient on its own for two offline devices; this design adds explicit local changes and transaction-based merging.

## 3. Account and login experience

The ATPL library and bank header expose a small account control: guest/login; or name/email, sync state, sync now and logout. Account creation is the first Google login; no app password is collected. Request only basic Google identity scopes.

Use Firebase UID as the storage owner key, never email, display name or a client-submitted account name. Firebase config is public client configuration; no Google client secret or service-account private key is shipped to the browser or committed to Git.

Login uses the Firebase Google provider and redirect on mobile. Follow Firebase's documented same-origin reverse-proxy option: set the Firebase authDomain to the Railway app origin and transparently proxy the reserved `/__/auth/` endpoints to the dedicated project's fixed `firebaseapp.com` host. Handle Google's callback only through the SDK. A popup may be offered on desktop, with redirect as the fallback; neither flow is advertised as working until tested against the real project.

The proxy has a fixed configured upstream, an explicit route prefix, GET/POST handling, size/time limits, manual redirect handling and no arbitrary target URL. It is evaluated before the static server's existing GET/HEAD-only guard. Auth helper frames must be embeddable by this same origin: do not blindly apply the static server's X-Frame-Options DENY to the proxied helper; allow only same-origin embedding for that route. Keep the other app routes' framing policy intact. The service worker must never intercept or cache auth-handler traffic. Do not alter weather/static-media behavior.

Bundle the pinned Firebase browser SDK locally, including all transitive browser imports, so reopening a downloaded bank never depends on loading a CDN script.

## 4. Guest, account isolation and account changes

Keep the original guest keys `atpl_<subject>_v2_state` unchanged. Signed-in accounts use a versioned namespace containing Firebase UID and bank code. Cached public question/media assets remain shared; they contain no user progress.

A small cached bootstrap runs before the original bank UI, selects the active local namespace and supplies a synchronous storage adapter. The UI awaits a local-only readiness promise for storage recovery and writer-lock acquisition before its first E.load; this promise must not await Firebase/network availability. After initialization, engine reads/writes remain synchronous. The engine bytes remain unchanged. Change only the UI's startup/storage selection and add a defined refresh bridge; no mutation of `Storage.prototype`, Firebase SDK internals or scoring-engine methods.

A remembered UID is only a local cache selector. It grants no cloud permission. Only Firebase Authentication plus Firestore rules authorize cloud requests. Account namespaces are activated after an authenticated SDK result, or reopened as the previously selected offline profile on that trusted device.

On an explicit account change/logout:
- serialize and persist current work before changing identity;
- stop listeners, pending transmissions and callbacks belonging to the previous UID;
- notify all open app tabs using BroadcastChannel with a storage-event fallback;
- close/reload study views into the new namespace before they accept another answer;
- keep any unsent changes under their original UID; never upload them under the new account;
- leave no previous account state in guest keys or visible guest screens.

On logout, clear active selection and Firebase persistence/session state, not public downloads. Private local snapshots remain isolated for a later login to their owner. The app does not claim to protect cached data from a person with operating-system/developer-tools access to the same device; users can export and remove their own local profile copy.

If a cached account's session expires, local study may continue under that cached profile, but cloud transmission stops. Show the identity and “Cần đăng nhập lại để đồng bộ”. A login to another UID cannot claim that queue.

## 5. Local durability and integration boundary

Preserve the original engine's synchronous save contract. For an account bank, one atomic localStorage envelope stores the engine-compatible state, the last acknowledged cloud baseline/revision, pending changes and an immutable in-flight batch. A save either persists both the new state and its sync obligation, or reports failure through the existing unsaved-state UI. There must be no successful local save followed by a silently missing asynchronous queue write.

Serialize concurrent same-bank tab updates through an exclusive Web Lock per UID/bank, held for the bank view's lifetime. A second account tab opens read-only and offers a retry after the first closes. Feature-detect Web Locks: an unsupported browser can view/export cached account state and use the unchanged guest mode, but cannot mutate that account bank; state this limitation before study. Do not use a homemade time-based lock or pretend localStorage has compare-and-swap. Validate account writing on the target modern Safari/WebKit and Chromium versions.

Question counts, answer values and source identifiers are validated against the bank before acceptance. Check state/operation sizes before cloud requests. Keep the existing export function for recovery. If local quota is exceeded, preserve the last durable envelope, show the unsaved warning and offer export of the current in-memory state; never show “Đã đồng bộ”.

A local history/queue size limit is a visible failure condition, not a reason to trim old exam reports silently. The first release keeps the current browser-storage capacity limitation; a separate IndexedDB migration is outside this change.

## 6. Cloud model

Use Firestore Standard with client-side transactions and memory-only Firestore caching. The app owns durable offline state and the outbox; it does not combine a second persistent Firestore write queue with its own acknowledgements.

Owner paths:
- `users/{uid}`: minimal schema/version metadata; profile name/email remain with Authentication unless explicitly needed.
- `users/{uid}/banks/{code}`: revision, normalized question statistics, wrong-set state, bookmark membership and field revisions, settings, selected resumable session identifiers.
- `users/{uid}/banks/{code}/sessions/{sessionId}`: study or unfinished-exam state, bank identity, session revision and last accepted server update.
- `users/{uid}/banks/{code}/exams/{reportHash}`: immutable completed report, split from bank core to avoid an ever-growing core document.
- `users/{uid}/banks/{code}/receipts/{batchId}`: immutable upload deduplication receipt and revision.
- `users/{uid}/banks/{code}/imports/{importHash}`: record of an explicitly accepted legacy import.

Include schema version and subject/bank identity in payloads. Bank core/session documents have a conservative 800 KiB client limit; exam reports and receipts have smaller validated limits. Split old report imports into bounded batches. Do not put media, bank question payloads, OAuth tokens or entire backups into cloud progress documents.

Exam report hashes use a documented canonical JSON representation of the existing report plus bank code. Copied/imported identical reports have the same ID. Existing reports lack independent UUIDs; exactly identical legacy reports are treated as duplicates. New exam sessions receive a stable sidecar UUID without changing the engine report or source data.

## 7. Synchronization and idempotency

Sync starts after authentication and local recovery. It runs while the app is open, after local changes settle, on reconnect/focus and when the user presses “Đồng bộ ngay”. Use bounded retries with backoff and no busy loop on permission/quota errors.

A durable immutable batch records a random stable batch ID, device ID, bank, acknowledged baseline, the exact sent local version and a normalized delta. Subsequent clicks form a tail after that sent version; they do not mutate the in-flight payload.

An online Firestore transaction:
1. reads the bank core, affected sessions and the batch receipt;
2. if the receipt exists, skips applying its delta and returns current acknowledged state;
3. otherwise validates and merges the delta, increments the bank revision, stores bounded affected data and creates the receipt atomically.

After an acknowledgement, rebase any local tail onto the returned remote state, persist the new baseline/envelope atomically and then clear the in-flight batch. If the server committed but the connection/acknowledgement/local receipt save failed, retry the same batch ID. Never synthesize a replacement ID for an uncertain batch.

Merge rules:
- New answer attempts/correct counts are additive deltas from the acknowledged baseline; each batch applies once. Per-question last answer/wrong status uses the later accepted bank revision, not the device wall clock.
- Bookmarks are explicit add/remove changes; removal is represented explicitly. Concurrent changes to the same membership use later accepted bank revision. A stale full bookmark list cannot resurrect a deletion.
- Independent completed exams are unioned by stable report identity.
- Unfinished exams/study sessions are separate session IDs. Two different exams never have their answer maps merged into one exam. Changes to the same session/question use later accepted server revision.
- The most recently accepted resumable-session selection is the default offered on a newly opened device. Remote updates do not jump a question or replace an active exam while the user is answering; show a refresh/resume choice at a safe boundary.
- Settings merge per field by accepted revision.
- Explicit reset/backup replacement is not inferred as a collection of negative counters. It requires confirmation and a new bank epoch; queued changes from an older epoch are preserved for export and reported as a conflict, not silently reapplied.

Server acceptance order resolves genuinely concurrent conflicts. Client timestamps are informational only and cannot determine precedence. If two offline devices disagree about the same bookmark/answer, the change synchronized later wins for that field; both devices' distinct counted attempts and independent exam reports remain.

## 8. Bringing existing progress into an account

Never silently upload guest/local-HTML progress. After successful Google login, show per-bank counts and choices: keep account progress, or review/import this device's guest progress. Preserve guest keys and create a downloadable pre-import backup.

A normalized import hash excludes changing export timestamps and includes bank and normalized state. Record imports transactionally to deduplicate the same backup accepted on both devices.

Legacy statistics are aggregates without globally unique attempt IDs. When account and imported data overlap, merge old per-question attempts/correct totals conservatively by maxima, with correct capped at attempts, not by pretending all old attempts were independent. Explain this in the import preview. Keep the exact source backup and individual exam reports; future post-login attempts use the exact additive/idempotent mechanism above.

Import bookmarks and history explicitly. Keep cloud sessions as the default if already present, while offering the imported resumable session separately. A migration is complete only after its core and all bounded report batches have been acknowledged. Declining migration leaves guest progress untouched and starts/restores the account normally.

Existing JSON export/import remains available. Import inside an account is a reviewed merge or explicit replacement operation following the epoch rule, rather than bypassing the sync protocol.

## 9. Offline behavior and status language

Keep the existing per-bank hashed offline manifests and verified media downloads. Precache the minimal account bootstrap, adapter, locally bundled SDK and required UI modules. Firebase public runtime config has a safe disabled response until configured and a cached known config for offline reopening.

Download readiness and sync readiness are independent:
- “Sẵn sàng offline”: all public bank assets verified and cached.
- “Lưu trên máy · còn N thay đổi chờ gửi”: local data durable, not yet acknowledged.
- “Đã đồng bộ lúc …”: all outstanding core/session/report batches are acknowledged for this account.
- “Offline”: cached account/guest work remains available.
- “Cần đăng nhập lại”, quota or permission error: local work retained; no false success.

A phone must have actually synchronized its latest work before an iPad can receive it. An offline iPad must previously have downloaded that bank and account data. No promise of new login, downloading missing questions or cross-device transfer without a network connection.

## 10. Security, privacy and provider configuration

Firestore rules default-deny every unmatched path. Require authenticated UID equality on every owner path; restrict allowed bank codes, schema/field types, size-sensitive fields and immutable IDs/receipts/reports. Deny cross-account lists, reads, creates and updates. Do not rely on the visible account selector or hiding a button as access control.

No Firestore test-mode rule, public read/write wildcard or Admin SDK credential is allowed in the browser/repository. Firebase rules, indexes and an emulator test suite are versioned and deployed with the feature. Authentication/proxy/config endpoints are excluded from service-worker caching except deliberately public client config.

Use a Firebase project dedicated to Pilot Logbook, owned by the user's Google account. Start on Spark, keep billing unlinked, disable optional Analytics for this scope, enable Google sign-in, configure the exact Railway authorized domain/redirect handler, register a web app and deploy locked-down Firestore rules before enabling production sync. Use a nearby supported Firestore location selected during setup; record the chosen immutable location.

If existing project ownership, terms, OAuth permissions or provider setup need the user's participation, prepare everything possible first and hand off the exact required step. No paid upgrade, billing-account attachment or unrelated-project reuse without the user's explicit instruction. A lack of provider configuration must be reported as not activated, not as a working production Google login.

Publish a short privacy notice describing Google identity, ATPL progress stored in Firebase, local offline copies, account isolation and the fact that logbook data stays local. Link it from login. Do not request Gmail/Drive/Calendar access.

## 11. Components to add/change

- Account bootstrap and namespaced storage adapter, isolated from the source engine.
- Firebase provider module and locally bundled dependency output with pinned versions/lockfile.
- Pure delta/rebase/import model plus transport that owns transactions, receipts and retries.
- Account/sync UI shared by library and per-bank pages.
- Strict auth-handler proxy/public-config route in the existing HTTP server.
- Firestore rules, indexes, emulator configuration and owner-isolation tests.
- Packaging-script injection of adapter/bootstrap/UI bridge, regenerated bank manifests/catalog and explicit compatibility version.
- Service-worker update preserving downloads, adding account assets and bypassing auth traffic.
- README/setup/privacy and recovery instructions.

Keep source `bank-data` and engine hashes identical to baseline. Old downloaded pages remain guest-only because account records never occupy legacy keys. A new bank HTML URL is required for the new bootstrap; unchanged hashed source images are reused. Update readiness checks honestly for the new HTML/assets.

## 12. Validation and release gates

Automated checks:
- original bank payload equality, all source keys/options/UIDs/counts and scoring-engine hash;
- delta/rebase behavior for two offline devices, duplicate retries, lost acknowledgements, local changes during upload, clock skew, bookmark deletion, session separation, report deduplication and reset epochs;
- local write/quota failures leave no false durability/sync success;
- migration accepted/declined, same backup on two devices, overlapping legacy counters and partial history import;
- Firestore emulator with two distinct authenticated users and an unauthenticated client: positive own-data access and negative cross-owner/path-tampering/list/immutable-write tests;
- Chromium and WebKit: cached guest/account reopening, two-device contexts, two-account switches, logout with an open bank tab, concurrent same-bank tabs, token expiry, provider failure, quota/permission errors and offline bank/image/backup functions;
- proxy route restrictions, method/body/time limits, callback no-cache/SW bypass and redirect behavior;
- unchanged logbook IndexedDB before/after login, study and account switching.

Production checks before claiming activation:
1. exact expected Firebase project, authorized origin and locked rules;
2. real Google login on the production Railway origin, with user participation for Google verification when needed;
3. sync acknowledged on device/context A and read on B; account B cannot see A's progress;
4. production-origin offline study, source images, save/resume and reconnect sync;
5. successful Railway health/deploy and preserved guest backups/download cache.

Report emulated-browser checks separately from any physical iPad/Safari/PWA check actually performed. Never substitute an emulator login for proof that real Google OAuth configuration works.

Roll out behind a disabled-by-default public feature flag. Provider/rules configuration and automated tests pass first; enable the flag for the final real-origin login/sync validation window, and declare activation only after those live checks succeed. If they fail, disable the flag again. Rollback disables login/sync while retaining guest use, public downloads, cloud records and account-local exports; it must not copy account data into guest storage or erase unsent work.

## 13. Primary references

- Google sign-in through Firebase: https://firebase.google.com/docs/auth/web/google-signin
- Safari/third-party-storage redirect best practices and same-origin proxy option: https://firebase.google.com/docs/auth/web/redirect-best-practices
- Firestore transactions and offline limitations: https://firebase.google.com/docs/firestore/manage-data/transactions
- Firestore offline cache semantics: https://firebase.google.com/docs/firestore/manage-data/enable-offline
- Owner rules and default-deny configuration: https://firebase.google.com/docs/firestore/security/get-started
- Limits/document sizes: https://firebase.google.com/docs/firestore/quotas
- Spark/Blaze plans: https://firebase.google.com/docs/projects/billing/firebase-pricing-plans

