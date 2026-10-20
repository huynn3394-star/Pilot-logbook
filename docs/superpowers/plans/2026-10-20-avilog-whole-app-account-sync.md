# AviLog Whole-App Accounts and Offline Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cá nhân hóa và đồng bộ hồ sơ, lịch bay, logbook, crew, cài đặt, thùng rác và ảnh theo cùng tài khoản Google của Ôn thi; tiếp tục dùng offline và giữ nguyên đáp án gốc.

**Architecture:** Dùng chung account coordinator/Auth hiện có, kho IndexedDB riêng theo UID và queue bất biến lưu cùng mỗi thay đổi. Firestore transactions/receipts gộp theo nhóm trường và ngăn trùng chuyến; Firebase Storage giữ ảnh riêng tư, IDB giữ byte cho offline. Giữ ATPL engine/namespace và cache nguồn hiện có; chỉ nối lớp tài khoản chung bên ngoài engine.

**Tech Stack:** Node 24, minimum hiện có 24.12.0; runtime phát triển đã dùng 24.19.0. Giữ Firebase 13.0.0, @firebase/rules-unit-testing 6.0.0, firebase-tools 15.34.0, esbuild 0.28.2, Playwright 1.62.1, pdfjs-dist 5.6.205, tesseract.js 7.0.0 và package-lock hiện có. Dùng private JDK 21 cho emulator, IndexedDB/Web Locks thật trong Chromium/WebKit. Không thêm thư viện ZIP, cơ sở dữ liệu Railway hoặc Firebase project thứ hai.

**Spec:** `docs/superpowers/specs/2026-10-20-avilog-whole-app-account-sync-design.md`, commit `75cee1e`, được người dùng duyệt ngày 20/10/2026.

**User amendment at execution approval:** thời tiết chỉ lưu raw text cho sân bay đi/đến trong ngày chuyến, không lưu ảnh. Spec §19 ghi hành vi. Task 1 thêm nhóm weather và validation; Task 4 rules cho metadata text; Task 7 backup giữ text; Task 8 nối automatic capture của chuyến hôm nay và xem offline; Task 10 kiểm thử hai sân bay/dedup/midnight/no-data/account switch. Không thay dịch vụ thời tiết hiện có bằng subsystem lịch sử mới.

## Global Constraints

- Địa chỉ giữ nguyên: `https://avilog-preview-preview.up.railway.app`.
- Giữ màu navy và đường link cũ. Chưa có xác nhận sao lưu để đổi tên miền.
- Không thay câu hỏi, lựa chọn, UID, đáp án, lời giải nguồn hoặc bộ máy chấm điểm. MB và MBR tiếp tục riêng.
- Không đổi namespace ATPL đang chứa tiến độ.
- Giữ nguyên database/khóa logbook cũ làm kho khách và nguồn phục hồi, không đổi tên hoặc ghi dữ liệu tài khoản vào đó.
- Dùng database mới `avilog-workspaces-v1`, schema phiên bản 1.
- Hiển thị thành công chỉ sau `oncomplete`.
- Không sử dụng Firestore whole-document last-write-wins cho logbook offline.
- Mỗi transaction chỉ chứa nhóm thay đổi nhỏ; giới hạn ứng dụng: tối đa 8 record domain, record tối đa 128 KiB JSON UTF-8, toàn yêu cầu/receipt tối đa 800 KiB.
- Chỉ JPG/PNG/WebP, `0 < bytes ≤ 6 × 1024 × 1024`. Không lưu data URL vào Firestore.
- Không bật upload đồng thời quá 2 ảnh.
- Phân trang records theo document ID (100/document page); tối đa 3 lần trong một lượt để lấy snapshot ổn định.
- Giữ hỗ trợ import v1 ≤ 50 MiB; phần backup mới ≤ 50 MiB; tối đa 10.000 flights trong bản nhập.
- Google UID quyết định quyền; identity đã nhớ chỉ dùng chọn cache, không cấp quyền cloud. Không xin quyền Gmail/Drive/Contacts/Calendar.
- Dùng đúng Firebase project `avilog-atpl`, database `(default)` tại `asia-southeast1`; không đổi Auth/OAuth/Firestore location hiện tại.
- Tài liệu này không bật billing/bucket. Khi kích hoạt phải dùng đúng billing account của chủ dự án, xác nhận mức cảnh báo và region; không tự chọn tài khoản không rõ chủ sở hữu.
- Không thêm Analytics, Gemini, Cloud Functions hoặc credential server vào client. Không tuyên bố cảnh báo ngân sách là trần chi phí Storage.
- Không sửa `sources/` hoặc đưa logbook/crew/ảnh thật vào Git và fixture công khai.
- Phân biệt kết quả emulator, production và iPad vật lý. Không hứa đồng bộ nền khi iOS đã đóng app.
- Điều khoản cũ chỉ đồng bộ ATPL/giữ Spark trong kế hoạch ATPL được thay cho phạm vi mới bởi đặc tả đã duyệt; không sửa lịch sử tài liệu cũ.

## Review Focus

1. Account đổi trong lúc file picker/OCR/backup/ảnh/ack đang chờ: kết quả A không xuất hiện hoặc ghi vào B, kể cả quota khiến lưu nháp thất bại (Tasks 2, 3, 6, 7, 8, 10).
2. Archive duty với hàng nghìn chuyến rồi chuyển một chuyến sang duty khác: restore không kéo chuyến đó trở lại, không vượt giới hạn transaction và không cộng thống kê sai (Tasks 1, 4, 8, 10).
3. Server đã ghi nhưng ack hoặc ghi IDB ack bị lỗi, trong lúc người dùng tiếp tục sửa: giữ đúng operationId, không nhân đôi và không mất phần sửa sau đó (Tasks 2, 4, 5, 10).
4. Multipart backup lẫn snapshot/UID hoặc thiếu một ảnh dù metadata đủ: reject phần sai, giữ bản phục hồi, không báo backup/restore đầy đủ (Tasks 6, 7, 10).
5. Shell/SW hoặc feature flag rollback lúc offline: giữ guest, account namespace và cache ATPL; ảnh riêng không vào public cache, form tài khoản không rơi về kho dùng chung (Tasks 3, 8, 9, 10, 11).

---

## Cách chia việc, workspace và lệnh

Đây là một subsystem workspace/ảnh gắn với tài khoản chung, cùng kho bền vững và quy trình nhập; thực hiện bằng một kế hoạch, 11 deliverable có test riêng. Không phát hành từng lớp trung gian như thể đã đồng bộ toàn app. Giữ cách **Native** người dùng đã chọn ở công việc ATPL trước đó: mình trực tiếp triển khai tuần tự vì giao diện repository/controller/ảnh phụ thuộc nhau, sau đó một reviewer độc lập kiểm tra toàn nhánh. Việc thực thi chờ người dùng duyệt bản kế hoạch mới này; không cần hỏi lại lựa chọn phương thức đã có.

Khi bắt đầu thực thi, đọc spec cùng plan, dùng using-git-worktrees: xem attachment, ưu tiên worktree phù hợp; nếu cần tạo mới dùng commit chứa plan này làm ref, không mặc định remote cũ thiếu spec/plan. Nếu công cụ managed không nhận repo lồng, dùng Git worktree trong thư mục `worktrees/` thuộc project writable. Không triển khai trên main. executing-plans tạo ledger, ghi baseline/ref, runtime, lệnh và bằng chứng RED/GREEN; không tạo goal tự động.

Kiểm tra runtime và private dependencies sẵn có trước khi cài. Không sửa symlink/shared node_modules của bundled runtime. Dùng Node/JDK task-private khi cần. Các lệnh `npm ...` dưới đây được chạy với Node 24 và npm task-private đã xác minh trong PATH; nếu phải gọi npm-cli.js trực tiếp thì ghi lệnh tương đương trong ledger. Localhost/emulator cần quyền mạng thì xin qua sandbox escalation ở bước chạy, không tắt sandbox toàn phiên.

Lệnh hiện có: `npm test`, `npm run test:rules`, `npm run test:account-browser`, `npm run build:atpl-account`, `node scripts/verify-atpl-account-storage.cjs`, `node scripts/verify-atpl-browser.cjs`. Không chạy script package-atpl.py chỉ để lấy help: script nhận đường dẫn HTML làm argv1 và có ghi output.

Lệnh mới theo Tasks 2/4/6/10: `npm run test:workspace-storage`, `npm run test:workspace-rules`, `npm run test:evidence-rules`, `npm run test:workspace-browser`, `npm run test:workspace-all`. Các runner tổng hợp gọi đúng test/module có tên ở mỗi task, fail-fast với mã thoát khác 0, giữ log/screenshot trong `test-results/avilog-workspace/` bị Git ignore. Emulator chỉ dùng project `demo-atpl-sync`, Auth 9099, Firestore 8080, Storage 9199. Không dùng config live làm fixture.

## File map và hợp đồng dùng chung

| File / vùng | Trách nhiệm |
|---|---|
| `public/workspace/schema.js`, `model.js`, `projection.js` | Plain-JSON contract/limits; gộp/validation; domain view từ record+tombstone |
| `public/workspace/repository.js` | IDB transaction, outbox/conflicts/Blob/recovery, Web Lock và guard |
| `public/account/coordinator.js`, `client.js` | Một identity/generation toàn app; loader client dùng config/bundle cũ |
| `public/atpl/account-bootstrap.js`, `account.js` | Wrapper tương thích, giữ bootstrapBank và old import paths |
| `public/workspace/firebase-transport.js`, `controller.js` | Firestore/receipt/pull ổn định; thứ tự queue, ack/retry/status |
| `public/workspace/evidence.js`, `evidence-transport.js`, `transfers.js` | Validate/hash ảnh; SDK Storage; queue truyền/cached offline |
| `public/workspace/migration.js`, `backup.js` | Nhập có preview/recovery và multipart backup xác định snapshot |
| `public/workspace/session.js`, `ui.js`, `backup-ui.js` | API cho app.js; account/conflict/offline controls; import/export UI |
| `public/atpl/firebase-client.js`, `scripts/build-atpl-account.mjs` | Giữ Firebase app hiện có, thêm factory workspace/Storage, bundle local |
| `lib/firebase-auth.js`, `.env.example` | Public config tương thích, flag/Storage bucket; giữ auth proxy |
| `firebase/firestore.rules`, `storage.rules`, `storage.cors.json`, `firebase.json` | Owner/schema rules, emulator và CORS origin chính xác |
| `public/app.js`, `public/style.css`, `public/sw.js`, `public/atpl/privacy.html` | Nối UI, shell offline, privacy đúng phạm vi |
| `tests/workspace-*.test.js`, `tests/*workspace*.emulator.js`, `tests/evidence*.emulator.js` | Kiểm thử unit và rules/SDK thật theo task |
| `scripts/workspace-emulators.cjs`, `verify-workspace-*.cjs` | Runner giới hạn localhost và browser QA; không endpoint test trong production |

Kiểu dữ liệu dùng trong các Interfaces sau là JavaScript plain objects (không yêu cầu đưa TypeScript vào repo):

- `Token = {uid:string|null,generation:number}`; `isCurrent(token)` phải đúng cả UID lẫn generation. Thao tác async nhận token và recheck trước ghi. Khách dùng adapter cũ, không giả UID `'guest'` là tài khoản cloud.
- `Record = {schemaVersion:1,kind:'profile'|'preferences'|'flight'|'duty'|'person',id:string,revision:number,archived:boolean,data:object,evidence?:EvidenceRef,archive?:object}`. Profile ID `'profile'`, preferences ID `'preferences'`. `data` không chứa attachment/token/device permission. ID domain giữ nguyên; recordKey là SHA-256 của kind + `\u0000` + id.
- `EvidenceRef = {sha256:string,mime:'image/jpeg'|'image/png'|'image/webp',bytes:number,cloudReady:boolean}`; metadata tham chiếu byte gốc. `cloudReady` chỉ đổi cho cùng digest sau xác nhận upload.
- `Snapshot = {schemaVersion:1,uid:string,cloudRevision:number,localVersion:number,records:Record[]}`; record archived vẫn giữ trong snapshot. Cloud revision không dùng Date.now().
- `Change = {kind,id,base:Record|null,next:Record}`; archive là next.archived, không next=null. `Operation = {schemaVersion:1,operationId,uid,deviceId,sequence,parents:string[],baseRevision:number,changes:Change[],importPart?:{hash,index,total}}`. Body đã gửi bất biến và hash canonical không chứa thời điểm retry.
- `MergeConflict = {kind,recordId,groups:string[],base:Record|null,local:Record,remote:Record|null,reason:string}`; `Conflict = MergeConflict + {id,uid,operationId}` được transport/repository bổ sung context, giữ các phiên bản nguyên bản để phục hồi.
- `Ack = {uid,operationId,operationHash,priorRevision,revision,results:Array<{kind,id,status:'accepted'|'already-applied'|'conflict',record?:Record,conflict?:Conflict}>}`. Receipt cũ trả kết quả đã lưu, không tính merge lại trên server hiện tại.
- `WorkspaceView` giữ `version:1,flights,duties,people,settings,trash,demo:false` tương thích domain hiện có. projection chỉ đưa active record vào danh sách chính và tombstone vào trash; Blob URL chỉ thuộc UI, không serialize vào cloud/backup.
- `Status = {kind:'local'|'pending'|'offline'|'syncing'|'synced'|'reauth'|'conflict'|'error'|'disabled'|'readonly',uid,pending,conflicts,at?:number,message?:string}`; số đếm/phản hồi gắn UID hiện hành. Ảnh có số chờ gửi và chờ tải riêng; synced metadata không đồng nghĩa ready offline.

## Task 1: Mô hình gộp, tombstone và bằng chứng nguồn bất biến

**Files:** Create `public/workspace/schema.js`, `model.js`, `projection.js`, `tests/fixtures/workspace.js`, `tests/workspace-model.test.js`, `tests/workspace-source.test.js`; consume `public/lib/domain.js`, `public/atpl/catalog.json` và `tests/atpl.test.js` không đổi thuật toán.

**Interfaces:** `recordKey(kind,id)->Promise<string>`; `validateRecord(record)->Record`; `validateOperation(op)->Operation`; `mergeRecord({base,local,remote})->{record:Record|null,conflict:MergeConflict|null}`; `applyChanges(snapshot,changes)->Snapshot`; `emptySnapshot(uid)->Snapshot`; `toWorkspaceView(snapshot,devicePreferences)->WorkspaceView`. Export constants `MAX_RECORD_BYTES=128*1024`, `MAX_OPERATION_BYTES=800*1024`, `MAX_RECORDS=8`, `PAGE_SIZE=100`, `MAX_PULL_ATTEMPTS=3`. emptySnapshot có cloudRevision/localVersion 0, records rỗng; projection dùng defaults hiện có khi chưa có profile/preferences, không tạo demo. Record cục bộ mới revision 0, record cloud đã nhận revision >0. Fixture `flightRecord(overrides={})` có VN0605 ngày 2026-10-09, UTC OUT 04:00/OFF 04:10/ON 05:00/IN 05:10, confirmed true, PIC 0/Night 0, crew rỗng, revision 1; luôn dùng dữ liệu tổng hợp.

- [ ] **Step 1 — Viết test RED.** Gộp note A với Scheduled B, nhưng không ghép Actual của hai bên; sửa cùng note khác giá trị là conflict. Cloud mới confirmed chặn thay Actual dựa trên bản chưa confirmed. False/0/chuỗi rỗng/xóa trường phân biệt không-thay-đổi. Ví dụ assertion:
```js
assert.deepEqual(mergeRecord({base,local:noteA,remote:noteB}).conflict.groups,['note']);
assert.equal(toWorkspaceView(archivedDutyWithReassignedFlight,{}).flights.find(f=>f.id==='moved').dutyId,'other-duty');
```
Test archive duty với 10.000 chuyến không phát 10.000 mutation, restore chỉ khôi phục liên kết còn trỏ duty; archive/edit conflict. Reject invalid UTC, PIC/Night vượt block, captain=FO, metadata quá 128 KiB, operation 9 record hoặc quá 800 KiB. Source test đọc catalog/bank-data/engine ở commit `9f8e20b91a047477e04e9be080aed8f3136a08ab` bằng `git show`, so với bản hiện tại; kiểm tra từng UID/options/answer, 6.426 câu, MB/MBR riêng và INS-03-U001 key F/choices E,F,G,H. Không lấy catalog hiện tại làm baseline tự tham chiếu.
- [ ] **Step 2 — Chạy RED:** `node --test tests/workspace-model.test.js tests/workspace-source.test.js`. Expected: assertions cho model mới thất bại; sửa lỗi đường dẫn/test harness trước khi coi là RED hợp lệ. Source baseline phải vẫn green.
- [ ] **Step 3 — Implement interfaces.** Dùng grouping chính xác ở spec §7, validate qua domain sau merge. Không dùng clock LWW. toWorkspaceView giữ duty backlink bền vững, chiếu trạng thái archived như spec §8, giữ dữ liệu trash. Không sửa engine/payload để qua test.
- [ ] **Step 4 — Chạy GREEN:** targeted tests rồi `npm test`; expected mọi assertion pass, nguồn/engine bằng baseline.
- [ ] **Step 5 — Commit** `feat: model conflict-safe personal workspaces` với đúng các file task.

## Task 2: Repository IndexedDB, writer lock và lưu atomic

**Files:** Create `public/workspace/repository.js`, `scripts/verify-workspace-storage.cjs`; modify `package.json` chỉ thêm script `test:workspace-storage`; use Task 1 fixtures/model. Execution clarification: dữ liệu ảnh lưu bằng ArrayBuffer + MIME sau khi WebKit native Blob abort/retry lỗi; API vẫn Blob và giữ đúng byte. `.gitignore` bỏ slash ở `.tooling` để không commit symlink công cụ riêng; không đổi dependency.

**Interfaces:** `openWorkspace({uid,token,isCurrent,locks=navigator.locks,onChange=()=>{}})->Promise<Repository>`. Repository: `uid`, `writable`, `read()->Promise<Snapshot>`, `save({changes,blobs=[],transfers=[],devicePatch,token})->Promise<Snapshot>`, `pending()->Promise<Operation[]>`, `acceptRemote(snapshot,token)->Promise<void>`, `acceptAck(ack,token)->Promise<void>`, `conflicts()->Promise<Conflict[]>`, `saveRecovery({source,sourceText,draft},token)->Promise<string>`, `getBlob(hash,token)->Promise<Blob|null>`, `putBlob(ref,blob,token)->Promise<void>`, `setTransfer(item,token)->Promise<void>`, `transfers()->Promise<object[]>`, `devicePreferences()->Promise<object>`, `exportCapture(token)->Promise<{snapshot,operations,conflicts,recoveries,transfers,evidenceRefs,pinId}>`, `unpinBlobs(pinId,token)->Promise<void>`, `releaseBlob(hash,token)->Promise<boolean>`, `resolveConflict({conflictId,changes},token)->Promise<void>`, `release()->void`. Repository tự tạo sequence/operationId/causal parents; data cloud là Task 1 plain JSON. Ghi archive/import cũng qua save, không sửa IDB trực tiếp từ UI. exportCapture chụp tất cả store liên quan và lưu export pin trong recoveries bằng một readwrite transaction để không có khoảng hở capture→pin; không thêm database/store ngoài spec. releaseBlob trả false nếu chưa cloudReady, pending hoặc có pin/recovery. Readonly session vẫn được exportCapture/unpin và lưu bản phục hồi với UID guard: các thao tác đó chỉ ghi metadata pin/recovery, không thay snapshot/outbox/ack hoặc chạy cleanup; không được biến ngoại lệ xuất này thành domain writer.

- [ ] **Step 1 — Viết RED trong browser thật:** snapshot + outbox + Blob + transfer cùng commit; abort sau put Blob nhưng trước complete giữ cả bốn store nguyên. Quota failure không báo save success. Mở A/B/guest không dùng chung key; second tab và thiếu Web Locks readonly nhưng vẫn xuất được fixed capture không sửa domain; đóng owner rồi take over được. Test acceptAck khi có operation mới: ack xóa đúng op cũ, giữ tail; IDB ack abort giữ op cũ để retry. Token đổi trong file/hash await chặn transaction; recovery quota lỗi không xóa nháp.
```js
assert.equal(afterAbort.localVersion,before.localVersion);
assert.deepEqual(afterAck.pendingIds,['op-after-send']);
assert.equal(await second.evaluate(()=>repo.writable),false);
```
- [ ] **Step 2 — Chạy RED:** `node scripts/verify-workspace-storage.cjs` với Chromium/WebKit; expected lỗi behavior mới, không coi IndexedDB giả bằng Map là đủ.
- [ ] **Step 3 — Implement** database 7 store/spec §5, key có UID, transaction guard và lock `avilog-workspace-v1:<uid>` có `ifAvailable`. Dùng queued IDB requests, không await mạng/hash bên trong transaction khiến nó auto-close; chuẩn bị Blob/hash trước, recheck token rồi tạo transaction. save có thể nhận nhiều Change cho roster: chia thành Operation ≤8 record/800 KiB theo dependencies, nhưng lưu toàn snapshot + các Operation + Blob/transfer trong một transaction IDB; server nhận từng op như spec bulk, không giả toàn bulk cloud atomic. Chỉ công bố state sau oncomplete. Đọc/nhận cloud đều dưới cùng writer; readonly không được ack hoặc sync ghi.
- [ ] **Step 4 — Chạy GREEN:** `npm run test:workspace-storage` và `npm test`; expected cả hai engine pass abort/reload/takeover/UID/tail. Giữ nguyên guest DB và các khóa ATPL.
- [ ] **Step 5 — Commit** `feat: persist account workspaces and pending work atomically`.

## Task 3: Dùng chung tài khoản và public config tương thích ATPL

**Files:** Create `public/account/coordinator.js`, `client.js`, `tests/workspace-account.test.js`; modify `public/atpl/account-bootstrap.js`, `account.js`, `firebase-client.js`, `lib/firebase-auth.js`, `.env.example`, `tests/firebase-auth-http.test.js`, `scripts/build-atpl-account.mjs`; regenerate only bundle/vendor manifest cần thiết.

**Interfaces:** Shared coordinator giữ API `getCoordinator()`, generation/getCachedSelection/capture/isCurrent/selectAuthenticatedUser/selectGuest/beginLoginIntent/cancelLoginIntent/subscribe/invalidateGeneration. Giữ localStorage `atpl_active_account_v1`, `atpl_account_signal_v1`, channel `atpl-account-v1`, singleton `ATPLAccountCoordinator`. Shared `getAccountClient()` chỉ có một promise; ATPL paths re-export, `bootstrapBank(identity)` vẫn tại đường dẫn cũ. Client `.transport(identity)` không đổi. Config thêm `{workspaceSyncEnabled:false,evidenceSyncEnabled:false,storageBucket?:string}`; env `AVILOG_WORKSPACE_SYNC_ENABLED`, `AVILOG_EVIDENCE_SYNC_ENABLED`, `FIREBASE_STORAGE_BUCKET`; evidence chỉ true khi accounts+workspace true và bucket thuộc đúng project. Emulator config thêm Storage localhost:9199 chỉ cho demo-* như Auth/Firestore.

- [ ] **Step 1 — Viết RED:** import client/coordinator từ hai đường dẫn trả cùng object/generation; main logout đánh dấu explicit guest như bank; cached UID offline không tạo authenticated user. Disabled workspace flag không đổi ATPL enabled. Evidence enabled thiếu/sai bucket hoặc emulator production origin phải reject. Account A async callback sau select B bị guard. HTTP config chỉ có trường public, không cache OAuth hoặc đổi auth proxy limits.
```js
assert.equal(sharedCoordinator,legacyCoordinator);
assert.equal(config.enabled,true); assert.equal(config.workspaceSyncEnabled,false);
assert.throws(()=>readFirebaseConfig(invalidBucketEnv),/bucket/i);
```
- [ ] **Step 2 — Chạy RED:** `node --test tests/workspace-account.test.js tests/firebase-auth-http.test.js`; expected shared interfaces/config mới red, test proxy cũ vẫn green.
- [ ] **Step 3 — Implement** chuyển coordinator/loader dùng chung và wrappers mỏng. Không đổi tên Firebase app `atpl-account-v1`, authDomain/redirect hoặc namespace bank. Không initializeFirestore lần hai. Giữ config URL `/atpl/firebase-config.json` và cached public config key cũ; thêm trường mặc định an toàn cho config cũ. Workspace dùng local boot trước client.ready. Chưa thêm import transport chưa tồn tại ở Task 4/6.
- [ ] **Step 4 — Chạy GREEN:** build bundle, targeted/unit, `npm run test:rules`, `npm run test:account-browser`, native storage suite cũ và mới. Expected account ATPL đang chạy/redirect/BFCache/explicit guest giữ nguyên; build hai lần output hash bằng nhau.
- [ ] **Step 5 — Commit** `refactor: share Google identity without migrating ATPL data`.

## Task 4: Firestore transport, receipts, flightKey và rules

**Files:** Create `public/workspace/firebase-transport.js`, `tests/workspace-firestore.emulator.js`, `tests/workspace-rules.emulator.js`, `scripts/workspace-emulators.cjs`; modify `firebase/firestore.rules`, `firebase/firestore.indexes.json` nếu query thực sự cần, `public/atpl/firebase-client.js`, `package.json`; regenerate local bundle.

**Interfaces:** `createWorkspaceTransport({db,uid,getAuthGeneration})->{pull():Promise<Snapshot>,commit(op):Promise<Ack>,subscribe(onRevision,onError):()=>void,close():void}`. Client thêm `.workspaceTransport()` cấp transport theo user thật; validateSession trước đồng bộ. Paths/record keys theo spec §6. `pull` phân trang documentId/root-before/root-after 100/page, thử tối đa 3 lượt rồi throw lỗi recoverable `workspace/unstable-snapshot` mà không nhận một phần. Transaction trả receipt cũ nếu operationHash bằng, reject nếu cùng ID khác hash; đọc tất cả trước ghi.

- [ ] **Step 1 — Viết RED với emulator thật:** A own allowed, guest/B/non-Google denied; path/list tampering và immutable receipt overwrite denied. A1/A2 cùng flightKey khác ID chỉ một active; đổi identity chuyến giải phóng claim cũ/giữ claim mới cùng transaction; archive giải phóng claim, restore bị chặn nếu đã có active khác. Test concurrent note/Actual, confirmed protection, lost ack, same-ID-different-hash, transaction 8 record kèm claims trong giới hạn rules. Ép root đổi giữa các trang bằng client thứ hai: pull retry, không công bố snapshot nửa chừng; 3 lượt bất ổn báo pending.
```js
assert.equal((await retrySameOperation()).revision,firstAck.revision);
await assertFails(otherUserReadsAliceWorkspace());
assert.equal(activeFlightsFor('2026-10-09:VN605').length,1);
```
- [ ] **Step 2 — Chạy RED:** thêm script `test:workspace-rules = node scripts/workspace-emulators.cjs rules`; runner mode rules chạy Auth+Firestore và hai file mới bằng Node test-concurrency=1. Expected lỗi assertion chưa có rules/transport, không bị credential hoặc project live.
- [ ] **Step 3 — Implement** transactions với Task 1 merge/validation, record revisions và root revision server-ordered, flightKey claim ownership, receipt outcomes. Rules kiểm tra UID Google, schema/allowlist, kích thước hợp lý, root/record/claim liên quan và immutable receipt, không nới wildcard ATPL. Giữ tombstone, không physical delete record/receipt; flightKey claim được chuyển/xóa đúng transaction domain. Pull chỉ listener root; cloud timestamps serialize về dạng báo cáo, không trở thành merge precedence. Factory dùng db singleton hiện có.
- [ ] **Step 4 — Chạy GREEN:** `npm run build:atpl-account`, `npm run test:workspace-rules`, `npm run test:rules`, `npm test`; expected legacy ATPL rules và negative tests đều pass. Đo actual rules document-access với batch 8, không chỉ đếm số write trên giấy. Receipt/hash/schema lỗi giữ local queue cho Task 5.
- [ ] **Step 5 — Commit** `feat: sync private logbook records with idempotent receipts`.

## Task 5: Controller causal queue, ack và trạng thái dữ liệu

**Files:** Create `public/workspace/controller.js`, `tests/workspace-controller.test.js`; extend `tests/workspace-firestore.emulator.js` cho causal integration.

**Interfaces:** `createWorkspaceController({account,repository,coordinator,transportFactory=()=>account.workspaceTransport(),onStatus=()=>{},online=()=>navigator.onLine,scheduler})->{syncNow():Promise<void>,schedule():void,status():Status,stop():void}`. Scheduler có `setTimeout`, `clearTimeout`, `random` để test deterministic. UI nhận status, không tự suy synced từ navigator.onLine. Repository của Task 2 giữ in-flight op bất biến và children/ack atomic; controller không ghi IDB riêng.

- [ ] **Step 1 — Viết RED:** queue cha trước con, conflict cha chặn cùng record nhưng record khác tiếp tục; ack local abort rồi retry cùng ID; người dùng sửa trong lúc gửi giữ tail; expiry/disabled/no-network không mất local. Coalesce focus/online/revision events không chạy song song. Dừng timer/listener/generation ngay khi đổi UID. Khoảng trống revision buộc pull, còn ack nối liên tục được áp dụng trực tiếp.
```js
assert.deepEqual(sentOperationIds,['parent','unrelated']);
assert.equal(controller.status().kind,'conflict');
assert.deepEqual(retryPayload,originalPayload);
```
- [ ] **Step 2 — Chạy RED:** `node --test tests/workspace-controller.test.js`; expected behavior assertions fail, scheduler test không ngủ thực.
- [ ] **Step 3 — Implement** debounce 2 giây, retries transient tối đa 5 lần với delay `min(60000,2000*2**attempt)*(0.8+0.4*random())`; auth/permission/schema conflict không tự retry nóng. Gửi op độc lập có thứ tự, validateSession/generation tại mọi boundary. Không nhận snapshot đè form; repository nhận domain, UI Task 8 giữ form base. Sync-only flag off vẫn đọc local của UID, không về guest.
- [ ] **Step 4 — Chạy GREEN:** unit + `npm run test:workspace-rules`; expected causal/lost-ack thật hội tụ, chỉ report synced sau receipt và IDB complete; no-data/new account khác với fetch failure.
- [ ] **Step 5 — Commit** `feat: coordinate causal workspace sync and recovery status`.

## Task 6: Ảnh riêng tư, transfer và tải offline

**Files:** Create `public/workspace/evidence.js`, `evidence-transport.js`, `transfers.js`, `firebase/storage.rules`, `firebase/storage.cors.json`, `tests/workspace-evidence.test.js`, `tests/evidence-rules.emulator.js`; modify `firebase.json`, `scripts/workspace-emulators.cjs`, `public/atpl/firebase-client.js`, package scripts; regenerate local bundle. Extend storage browser runner Task 2 cho Blob/transfer.

**Interfaces:** `prepareEvidence(file)->Promise<{ref:EvidenceRef,blob:Blob}>` kiểm tra byte/MIME/decode/hash, ref.cloudReady=false. `createEvidenceTransport({storage,uid,getAuthGeneration})->{upload({ref,blob,onProgress,signal}):Promise<void>,download(ref,{signal}):Promise<Blob>,close():void}`. Client `.evidenceTransport()` chỉ khi đúng config/user, dùng getStorage của cùng Firebase app và connectStorageEmulator khi localhost. `createTransfers({account,repository,coordinator,transportFactory,onStatus})->{pump():Promise<void>,downloadAll():Promise<void>,status():object,releaseCached(hash,token):Promise<void>,stop():void}`. Storage path `users/<uid>/evidence/v1/<sha256>`, getBlob/getBytes authenticated, không getDownloadURL trong app.

- [ ] **Step 1 — Viết RED:** thật 0/6 MiB/6 MiB+1, giả MIME/HTML/SVG, digest không khớp; A/B/unauth/non-Google, prefix/list tampering, overwrite/delete denied. Interrupted resumable/reload giữ original Blob; upload response lost đọc lại và verify byte; changed digest/account trước callback không gắn nhầm; metadata synced còn ảnh pending không báo toàn bộ synced. Hai worker tối đa, cùng UID dedup/cross-UID riêng; downloadAll gồm ảnh trash và báo thiếu/hỏng rõ. Token đổi giữa download và put IDB không lưu vào B.
```js
assert.equal(maxConcurrentUploads,2);
assert.equal((await repository.read()).records[0].evidence.sha256,newDigest);
await assertFails(bobReadAliceImage());
```
- [ ] **Step 2 — Chạy RED:** `node --test tests/workspace-evidence.test.js`; `test:evidence-rules = node scripts/workspace-emulators.cjs evidence` chạy Auth+Firestore+Storage/9199 với tests/evidence-rules.emulator.js. Expected assertions fail, không cấu hình bucket live để qua test.
- [ ] **Step 3 — Implement** model/SDK/transfer contract và owner create/read-only rules. Không hardcode service-account/token hoặc lưu URL resumable vào export. Blob local sống qua retry; bytes/metadata giới hạn như spec, confirmed upload chỉ publish cloudReady cho đúng digest. Direct download recheck hash trước putBlob; object tồn tại sai hash là lỗi giữ local, không overwrite. Hủy task khi UID đổi; object đã gửi nhưng không còn tham chiếu được giữ để phục hồi. releaseCached chỉ được bỏ bản đã có cloud và không pin/recovery/pending, có confirmation tại UI. CORS file chỉ origin production cũ và SDK methods/headers cần thiết; emulator origin cấu hình riêng, không wildcard production.
- [ ] **Step 4 — Chạy GREEN:** build bundle, evidence unit/emulator, native storage suite, workspace rules và legacy rules. Expected no cross-account/public access, failure ảnh không chặn save chuyến, offline Blob reload được. Ghi rõ MIME/rules không chứng minh hash byte; browser verify đảm nhiệm việc đó. Chưa bật bucket thật.
- [ ] **Step 5 — Commit** `feat: sync private evidence and retain verified offline images`.

## Task 7: Nhập dữ liệu cũ, recovery và multipart backup

**Files:** Create `public/workspace/migration.js`, `backup.js`, `tests/workspace-migration.test.js`, `tests/workspace-backup.test.js`; extend `scripts/verify-workspace-storage.cjs`, `tests/workspace-firestore.emulator.js` cho imports/receipts.

**Interfaces:** `previewMigration({source,sourceText,current:Snapshot,selectedIds,includeDemo=false})->Promise<Preview>`; Preview gồm targetUID/counts/bytes/profilePreferences/collisions/blockedRows, raw source/sourceText, normalized changes, canonical importHash và part descriptors nếu multipart. `stageMigration({repository,preview,confirm,token})->Promise<boolean>` lưu raw recovery trước bất kỳ operation nhập, false nếu từ chối. `captureBackup({repository,token})->Promise<Capture>` chụp fixed snapshot + pin digest; `Capture={uid,backupSetId,snapshot,operations,conflicts,recoveries,transfers,evidenceRefs:EvidenceRef[],pinId}` lấy bằng Repository.exportCapture. `exportBackupParts({capture,loadBlob,allowMissing=false,maxBytes=50*1024*1024})->AsyncIterable<{filename,jsonText}>`; caller finally unpinBlobs sau xuất/hủy. `previewRestore({parts:AsyncIterable<{name,text:()=>Promise<string>}>,targetUID,current:Snapshot})->Promise<Preview>` đọc mỗi part từ File descriptor theo nhu cầu, không tải trước toàn bộ ảnh lên RAM; `stageRestore({repository,preview,confirm,token})->Promise<boolean>` dùng cùng stageMigration, xác minh lại từng part khi staging. Format mới `format:'avilog-workspace-backup',version:2`; manifest không tự hash chính nó, hashes áp dụng canonical payload mỗi phần. Recovery format riêng `avilog-workspace-recovery`,version:1 chứa raw source/outbox/conflicts, không tự gửi queue cũ trực tiếp lên cloud sau import.

- [ ] **Step 1 — Viết RED:** decline/demo không tạo upload; recovery quota abort không nhập; v1 ≤ 50 MiB và ≤ 10.000 flights; same import hai thiết bị chỉ một bản, confirmed current giữ. ID không an toàn như `'a/b'` chỉ nằm data, hashed path; invalid record không bị cắt/normalise mất nguồn. Multipart thiếu/lặp khác hash/lẫn backupSetId/đổi UID/ảnh thiếu phải báo chính xác. Export khi user đang sửa vẫn một snapshot; cloud byte khác digest không được thêm vào phần sau. Import source email/UID không chuyển account.
```js
assert.equal(await stageMigration(declined),false);
assert.equal(parts.every(p=>p.backupSetId===setId),true);
assert.equal(missingImagePreview.complete,false);
```
- [ ] **Step 2 — Chạy RED:** `node --test tests/workspace-migration.test.js tests/workspace-backup.test.js`; browser storage runner cho atomic recovery; expected behavior mới red, lỗi malformed không đổi state.
- [ ] **Step 3 — Implement** parser/preview/import hash/spec §10. Normalize canonical selected content không có UID/device/time; không tự gộp unknown field hoặc dữ liệu demo. Generate chunk ≤8 record/800 KiB, crew+duty trước dependent flight, imports hash/index receipt state bảo đảm resume. Backup nhiều phần ≤50 MiB theo UTF-8/dataURL thực tế, không giữ mọi ảnh trong RAM; cho đủ/thiếu ảnh bằng manifest rõ, restore stage từng phần đã kiểm tra và progress không báo hoàn tất sớm. Workspace backup cho restore không ghi đè queue chưa ack của tài khoản hiện có; recovery giữ originals để người dùng xem/nhập qua preview. ATPL backup giữ định dạng riêng.
- [ ] **Step 4 — Chạy GREEN:** unit, storage browser, workspace emulator import concurrent/resume; expected guest byte-for-byte không đổi, last confirmed Actual giữ nguyên, thiếu phần/ảnh không được báo complete và không làm mất dữ liệu cũ.
- [ ] **Step 5 — Commit** `feat: review legacy imports and export complete workspace backups`.

## Task 8: Nối trang chính và các tính năng theo tài khoản

**Files:** Create `public/workspace/session.js`, `ui.js`, `backup-ui.js`, `tests/workspace-session.test.js`, `scripts/verify-workspace-ui.cjs`; modify `public/app.js`, `public/style.css`, `public/lib/storage.js` chỉ khi cần export guest adapter tương thích; dùng domain hiện có và Task 1 projection.

**Interfaces:** `openWorkspaceSession({coordinator,onView,onStatus,onTransition})->Promise<Session>` khởi động local trước Auth. Session: `view()`, `captureForm()->{token,base:Snapshot}`, `saveView({base,next,token,evidenceFile,confirmActualReplacement=false})->Promise<WorkspaceView>`, `archive(kind,id,token)->Promise<WorkspaceView>`, `restore(archiveId,token)->Promise<WorkspaceView>`, `saveDevicePreferences(patch,token)->Promise<void>`, `prepareSwitch({draft,exportDraft,confirmDiscard})->Promise<boolean>`, `release()->void`. `saveView` diff với base đã chụp, chuyển thành Task 1 nhóm trường/Task 2 operations; không gửi toàn state. `mountWorkspaceUI({element,session,account,coordinator,controller,transfers})` trả `{render,dispose}`; `mountBackupUI({element,session,repository,migration,backup,transfers})` không có quyền tự chọn UID.

- [ ] **Step 1 — Viết RED session/UI:** guest DB cũ vẫn mở, account mới trống không sample; lỗi pull là chưa tải chứ không empty demo. Header main có login390px; user A ở schedule/logbook/crew/stats/settings cùng UID với bank. Scheduled import giữ confirmed; form mở không bị remote render đè, save kiểm tra base; delete/restore duty nhiều link theo Task1. Account change trong OCR/file/backup không gọi save B. Quota nháp cho export hoặc explicit discard để vẫn logout, không auto bỏ nháp. Quyền Notification riêng từng thiết bị, giờ nhắc sync; exports chỉ current UID; stats confirmed-only.
```js
assert.equal(session.view().demo,false);
assert.equal(otherAccountView.flights.length,0);
assert.equal(notificationPermissionRequestedOnRemoteSettingsSync,false);
```
- [ ] **Step 2 — Chạy RED:** `node --test tests/workspace-session.test.js` và `node scripts/verify-workspace-ui.cjs` trên local harness với network app fetch bị chặn nếu có. Expected chưa có account main/data isolation, không dùng mock UID làm bằng chứng OAuth.
- [ ] **Step 3 — Implement** session và thay commit(next) của app bằng saveView có base/token; tất cả save paths (flight/duty/crew/settings/roster/image/restore/trash) qua session, không sót direct writeState. Guest adapter vẫn gọi readState/writeState. Ảnh URL từ registry UID của evidence layer: không nới safeImage thành chấp nhận mọi blob/http string từ backup; untrusted dataURL vẫn validate. Hiển thị account/sync, conflict choices/recovery, tải ảnh offline, preview nhập/backup progress; escape text không dùng email/note như HTML. Làm rõ backup logbook và Ôn thi riêng, weather/OCR chưa sẵn cần mạng. Thay placeholder mô tả “chưa đồng bộ” khi account thực sự có tính năng; không thêm Free/Pro/FTL/push.
- [ ] **Step 4 — Chạy GREEN:** unit/session, UI390×844 và1024×1366, domain regressions, native storage. Expected main offline UI không chờ SDK, guest untouched, record/conflict UI không nói đã đồng bộ khi còn pending, archive projection giữ liên kết đúng.
- [ ] **Step 5 — Commit** `feat: personalize the AviLog main workspace by Google account`.

## Task 9: Shell offline và tương thích tất cả ngân hàng ATPL

**Files:** Modify `public/sw.js`, `tests/atpl-service-worker.test.js`, `scripts/verify-atpl-account-browser.cjs` để nhận shared account paths; create `tests/workspace-service-worker.test.js`; modify `public/atpl/account-ui.js`/`catalog-ui.js` chỉ nếu cần status chung, không đổi engine/keys. Update package test scripts nếu cần.

**Interfaces:** Shell version mới `avilog-shell-v4-workspace`, precache public/account + workspace module graph và bundle local. Giữ cache `avilog-atpl-v1`. SW chỉ cache static allowlist/public bank/media; `/api/`, `/__/auth/`, private evidence và request non-GET/authenticated không cache theo static path. Status broker `publishAreaStatus({uid,area,code?,status})`, `readAreaStatus(uid)->object` tại `public/account/coordinator.js`, báo theo tab/generation; chưa có bank status thì dùng “Ôn thi: kiểm tra trong Ôn thi”, không suy synced.

- [ ] **Step 1 — Viết RED:** upgrade từ v3 giữ MB/source image + account progress; main-login→bank và bank-logout→main same identity. Tắt workspace/evidence flag trong config không chuyển UID về guest và không ghi vào old DB. Firestore/Storage/config fail không poison shell installation hoặc làm guest không mở. Private Blob/network request không vào public CacheStorage; unsupported lock readonly. Header không báo toàn bộ synced nếu Ôn thi chưa kiểm tra.
```js
assert.equal(cacheNames.includes('avilog-atpl-v1'),true);
assert.equal(publicCacheEntries.some(url=>url.includes('/evidence/')),false);
assert.notEqual(globalStatus.kind,'synced');
```
- [ ] **Step 2 — Chạy RED:** `node --test tests/workspace-service-worker.test.js tests/atpl-service-worker.test.js` và bank/main browser scenarios; expected new modules/allowlist/status red.
- [ ] **Step 3 — Implement** shell và optional public config fetch không làm install fail; offline bootstrap nhận cache IDB trước bất kỳ 8s config timeout. Account broker không đưa payload cá nhân vào channel, chỉ signal/status; reset visible status khi generation đổi. Giữ old import paths để ưu tiên không sửa bank HTML. Chỉ nếu thay wrapper thật sự cần thì chạy `python3 scripts/package-atpl.py <verified-source-html>` với hash nguồn `28fbacae42e5b05023c89b077d977e62184a2e916da0dc7d14bd521acd89239f`; xác minh trước dùng. Không tạo source thay thế hoặc reupload media packs không đổi.
- [ ] **Step 4 — Chạy GREEN:** build bundle, SW/source tests, `npm run test:account-browser`, `node scripts/verify-atpl-account-storage.cjs`, `node scripts/verify-atpl-browser.cjs`, `npm test`. Expected tất cả source keys grade đúng, engine SHA `d2500d598ca2c997459d1c2f10b6ce72e78eee7a2ea5b93e137dc1d540625872` không đổi và cache source dùng offline.
- [ ] **Step 5 — Commit** `feat: preserve offline banks while sharing whole-app identity`.

## Task 10: QA toàn luồng bằng SDK/emulator và browser thật

**Files:** Create `scripts/verify-workspace-browser.cjs`, `docs/workspace-verification.md`; modify `scripts/workspace-emulators.cjs`, `package.json`; output ignored `test-results/avilog-workspace/report.json`, screenshots, backup fixtures tổng hợp. Add targeted regressions vào file task sở hữu nếu QA phát hiện lỗi.

**Interfaces:** `test:workspace-browser = node scripts/workspace-emulators.cjs browser` chạy đủ Auth/Firestore/Storage; browser harness dùng actual createServer và SDK cùng Google emulator UI, không set cached UID thay OAuth. `test:workspace-all` tuần tự chạy npm test, storage/UI runners, legacy rules, workspace rules, evidence rules, legacy account browser, whole-workspace browser và existing full-source browser suite; mỗi process exit code được kiểm tra. Report có versions/commit, tests pass/fail, offlineMode, failures, source hashes, paginationReads/bytes/time, realGoogleOAuth:false, physicalIPad:false.

- [ ] **Step 1 — Viết acceptance tests RED:** hai browser contexts A1/A2 cùng Google UID, B khác UID, guest riêng. A1 offline tạo chuyến/crew/duty/settings/ảnh; reopen vẫn có; reconnect sync A2 nhận đúng byte/hash, B denied. Hai máy offline cùng sửa Actual hiện conflict; Scheduled+note độc lập hội tụ. Thử timeout sau commit, ack-IDB abort, parent conflict, account switch trong 5 async flows ở Review Focus. Multipart với missing image/digest mismatch và đổi UID giữa phần không báo complete. 10.000 chuyến tổng hợp, >100/page root thay giữa trang, archive duty/restore/reassign đúng. Cả MB và MBR/source images/bookmark/resume/export sau account main switch vẫn đúng.
```js
assert.equal(receivedFlight.actual.in,'2026-10-09T05:10:00.000Z');
assert.equal(receivedImageHash,uploadedImageHash);
assert.equal(bobView.flights.length,0);
assert.equal(report.sourceQuestionCount,6426);
```
- [ ] **Step 2 — Chạy RED:** `npm run test:workspace-browser`; expected scenario assertion phát hiện integration chưa nối; nếu toàn bộ đã green, chứng minh test sensitivity bằng test-only injection bỏ guard/ack (không commit thay production) và ghi failure, không viết test luôn pass.
- [ ] **Step 3 — Fix integration tối thiểu** ở module sở hữu; giữ test RED pin bug, không test-only trust bypass. Chromium dùng context offline thật. WebKit thử offline thật; nếu engine hiện tại có hạn chế network emulation như bộ cũ, chặn cả origin/Auth/Firestore/Storage ở test harness, ghi rõ mode và số requests bị chặn; không gọi đó là physical iPad airplane test. Test OAuth mobile redirect với iPad Macintosh+touch và desktop popup trong cùng SDK emulator.
- [ ] **Step 4 — Chạy GREEN:** `npm run test:workspace-all`. Expected tất cả exit0, không JS exception không giải thích; report chỉ dùng dữ liệu tổng hợp. Báo riêng chẩn đoán network bị cắt hợp lệ, không lọc lỗi sync thật. Ghi số read/thời gian/byte của 10.000 chuyến, không đặt quota/chi phí tưởng tượng và không auto download mọi ảnh lúc mở main.
- [ ] **Step 5 — Commit** `test: verify whole-app isolation offline recovery and source keys`.

## Task 11: Review độc lập, bật Storage đúng chủ dự án và phát hành

**Files:** Modify `README.md`, `public/atpl/privacy.html`, `docs/workspace-verification.md`, `.env.example`, CORS/rules chỉ theo config đã xác nhận; create `docs/workspace-sync-decisions.md`, `docs/WORKSPACE-Account-QA.json`; evidence private ở `../output/avilog-whole-app-sync/` gồm release-evidence/live checks, không commit email/token/ảnh/logbook thật. Không dùng review output để tự thay yêu cầu người dùng.

**Interfaces:** Consumes green committed branch/task ledger và toàn bộ test/source hashes. Public config flags tắt độc lập; candidate build vẫn giữ local account namespaces. Deployment ở repo `huynn3394-star/Pilot-logbook`, Railway service/origin cũ; Firebase project `avilog-atpl`. Các identifier live phải đọc lại từ connector/console đúng account trước thay đổi, không tin ID cũ là chứng cứ ownership hiện tại.

- [ ] **Step 1 — Hoàn tất tài liệu và request một review toàn nhánh** theo executing-plans/requesting-code-review cho cách Native đã chọn. Review độc lập tập trung source immutability, five Review Focus, rules, dữ liệu/ảnh riêng tư, backup, runtime advisories và rollback. Expected không có Critical/Important chưa giải quyết; sửa theo RED/GREEN rồi full required suite. Ghi ruling/minor còn lại, không nhận góp ý làm thay đáp án hoặc bỏ offline.
- [ ] **Step 2 — Chuẩn bị kích hoạt có thể duyệt:** đọc project/billing/bucket thực tế, trình region Singapore/location code hỗ trợ, đúng billing account chủ sở hữu, dung lượng ảnh đo được và thành phần phí hiện hành từ tài liệu chính thức. Người dùng đã chọn Firebase có phí; không hỏi lại lựa chọn đó. Chỉ hỏi thông tin còn thiếu như billing account/mức cảnh báo cụ thể hoặc bước Google yêu cầu chính chủ. Không chấp nhận terms/card thay họ, không tạo project khác. Trước khi cần họ thao tác, hoàn tất code/tests/rules/CORS/config có thể chuẩn bị. Chưa có quyền/provider thì giữ flag tắt và báo chính xác phần chờ, không tuyên bố full app sync live.
- [ ] **Step 3 — Cấu hình đúng tài nguyên:** tạo/enable bucket theo region đã xác minh, private rules/CORS/indexes; không đổi Firestore location/OAuth provider hoặc rules ATPL. Tạo budget alert đúng mức chủ dự án chọn, ghi rõ không hard cap Storage. Không lifecycle xóa ảnh/trash và không bật public sharing/Analytics/Gemini/Functions. Dùng SDK production tự kiểm tra own access và other/unauth denied trên dữ liệu QA tổng hợp, không nhập guest logbook thật tự động.
- [ ] **Step 4 — Publish candidate với defaults disabled:** verify `npm run test:workspace-all`, tree sạch ngoài evidence ignored, immutable source check; publish Git qua quyền đúng chủ repo với expected-head lease, không force hoặc reset remote. Nếu remote đã đổi từ baseline, tích hợp và chạy lại checks liên quan trước push; không ghi đè. MCP fallback nếu CLI không ghi được: kiểm SHA blobs/tree và lease đúng remote HEAD, không upload lại `data/atpl-media` không đổi. Nếu tạo PR thì attach_artifact theo tool instructions. Deploy đúng candidate commit, health check và shell/account-local smoke trước bật workspace flag; bank vẫn hoạt động.
- [ ] **Step 5 — Bật theo cửa sổ kiểm chứng production:** bật workspace sync, kiểm dữ liệu và Google login thật main↔bank; bật evidence sau private bucket/CORS sẵn sàng, kiểm ảnh A→A2 đúng hash và B không đọc được. Thử pending ảnh/mạng/provider failure không mất local; production origin tải ảnh/MB trước, tắt network rồi reopen/sửa/backup/học, reconnect nhận ack đúng. Chỉ user-triggered preview/confirm mới đưa dữ liệu khách thật lên cloud. Yêu cầu người dùng thử điện thoại/iPad thật khi code/provider checks sẵn sàng; ghi chính xác manual pass hoặc chưa kiểm chứng, không thay bằng emulator.
- [ ] **Step 6 — Chuẩn bị rollback và bàn giao:** nếu live fails, tắt flags độc lập trong **build có namespace mới**, giữ cache/queue/Blob/recovery/cloud và ATPL; không rollback về build một kho dùng chung, không disable billing toàn project hoặc xóa bucket. Báo URL cũ, cách login/tải offline/sync/backup, giới hạn thực tế và số kiểm thử. Live report chỉ `activated:true` nếu gates trên pass; physical iPad có cờ riêng theo bằng chứng người dùng. Commit tài liệu/evidence công khai đã khử dữ liệu cá nhân, finish branch theo skill và chỉ dọn worktree sau preserve ignored tooling/evidence cần thiết.
- [ ] **Step 7 — Commit** `docs: record whole-app sync rollout and offline verification`; xác nhận local/remote commit và deployment khớp, không tự đổi URL sang avilog.up.railway.app.

## Spec coverage và tự rà soát

| Đặc tả | Tasks / bằng chứng |
|---|---|
| §1–3 intent, phạm vi, cài đặt riêng máy | 1, 3, 8, 11 |
| §4 tài khoản chung/chuyển tài khoản | 2, 3, 6, 8, 9, 10 |
| §5 IDB/offline/writer | 2, 5, 6, 8, 9, 10 |
| §6 Firestore/pagination/receipt/import | 1, 4, 5, 7, 10 |
| §7 merge/confirmed/conflict/causal | 1, 2, 4, 5, 8, 10 |
| §8 trash/duty backlinks | 1, 4, 8, 10 |
| §9 ảnh riêng/transfer/offline | 2, 6, 8, 9, 10, 11 |
| §10 migration/backup nhiều phần | 2, 7, 8, 10 |
| §11 status/errors/privacy | 3, 5, 6, 8, 9, 10, 11 |
| §12 billing/region/provider | 3, 6, 11 |
| §13 nguyên đáp án/cache/namespace | 1, 3, 9, 10, 11 |
| §14 boundaries | File map và Interfaces của 1–9 |
| §15 QA | RED/GREEN từng task + 10/11; live/physical phân biệt |
| §16 release/rollback | 3, 8, 9, 11 |
| §17–18 self-review/references | Tự rà soát tại đây; dùng refs spec, kiểm tài liệu giá lúc activation |

Đã tự kiểm: 11 task đều có file cụ thể, consumes/produces hoặc interface signature dùng chung, test assertions, RED command, implement step, GREEN command và commit. Task 2 sở hữu IDB, Task 4 sở hữu Firestore, Task 6 sở hữu Storage; controller/UI không viết vòng qua repository. Tất cả tên Repository/Session/Transport/Ack/Record/Token ở task sau dùng hợp đồng tại đây, không tạo engine ATPL thứ hai. Mỗi Review Focus có test của module sở hữu và acceptance Task 10. Code block chỉ minh họa assertion, không viết sẵn toàn bộ triển khai.

**Trạng thái handoff:** kế hoạch viết xong để duyệt; mọi checkbox execution còn trống. Chưa cài dependency, tạo worktree mới, sửa app, nâng billing, tạo bucket hoặc phát hành. Người dùng duyệt kế hoạch trước khi thực thi. Giữ Native đã chọn trước đó: mình trực tiếp làm trong chat bằng executing-plans, một reviewer toàn nhánh ở cuối; không hỏi lại phương thức. Chỉ đổi sang Subagent-driven nếu người dùng yêu cầu đổi sau khi xem kế hoạch.
