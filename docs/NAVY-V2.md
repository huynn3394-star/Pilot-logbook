# Navy V2 — audit và phạm vi triển khai

## Nền mã nguồn (02/11/2026)

Nhánh riêng `feat/avilog-navy-v2-2026-11-02`, từ main `4e93e03`. JavaScript ESM + Node HTTP + PWA; không có React/Next/Supabase. Package manager npm (package-lock). Routing chính bằng `tab` trong `public/app.js`; ATPL dùng trang riêng. Firebase Auth/Firestore/Storage thật đã được tích hợp. IndexedDB và workspace theo UID, causal outbox/receipts/conflicts, bản phục hồi và capability V14 phải giữ nguyên.

Giữ nguyên: `public/lib/domain.js`, flight-times/audit/UTC, parsers/OCR, storage, account coordinator/client, workspace repository/session/controller/transport/backup/migration, Firebase rules, server/API và ngân hàng ATPL. Monthly Actual của Avilog hiện là **block của chuyến đã confirmed**; airborne là OFF→ON riêng. PF/PM không đồng nghĩa PIC/SIC. SIC V14 nhập thủ công; record cũ dùng quy tắc tương thích Block−PIC. Instrument bị giới hạn bởi airborne, không mặc định bằng block.

## Kế hoạch theo file

| File | Thay đổi |
| --- | --- |
| `public/ui/tokens.css`, `system.css` | Navy tokens dùng chung, ngày/đêm, độ tương phản và trạng thái nghiệp vụ độc lập |
| `public/ui/navy-v2.js`, `navy-v2.css` | Flight Card, nhóm tháng, tìm kiếm, bộ lọc, danh sách phân trang giới hạn DOM, bottom sheet/native dialog và mobile navigation |
| `public/app.js` | Nối UI với record/action hiện hữu; More điều hướng, management riêng, account backup/restore, bảo vệ rời bản nháp |
| `public/workspace/ui.js` | Ba gạch Tài khoản & Đồng bộ, trạng thái workspace thật; nối backup/restore hiện hữu |
| `public/lib/flight-editor.js` | Bố cục Departure/Arrival, counters trên các trường V14 đang có, trạng thái Lưu; không thêm field backend |
| `public/index.html`, `public/sw.js` | Nạp/cache asset mới, version shell riêng; không xóa site data |
| `tests/navy-v2.test.js`, `scripts/verify-navy-v2.cjs` | Logic lọc/tổng, dữ liệu bất biến, browser UI/save/reload/offline và kích thước danh sách |

## Rủi ro và giới hạn trước triển khai

- Đã nhận và đối chiếu 12 ảnh `IMG_2548.PNG` đến `IMG_2559.PNG`. ZIP prototype vẫn chưa có; triển khai trực tiếp trên repo dựa vào đặc tả và ảnh. Không nhập dữ liệu chuyến bay hoặc thương hiệu từ ảnh vào app.
- Không thay schema, IDs, ownership, giá trị lịch sử, dữ liệu ATPL, API hay Firebase rules. Không chạy production migration. Không tạo field tạm trong note/localStorage để giả lập field backend.
- Stick/Rest, distance, procedures/threats, approach và dịch vụ OFP/ADS-B chưa có model/API tương ứng; không tạo nút giả hoặc ghi các field này. Sims nằm ở duty, không phải flight logbook; chưa trộn giờ SIM vào thống kê bay.
- Spec nói menu trên mở management nhưng yêu cầu người dùng đã chốt ba gạch chỉ Tài khoản & Đồng bộ: giữ account ở góc phải; management có nút riêng và More chỉ điều hướng.
- Audit nền: 288 unit, 250 browser checks, 34 rules tests đạt. npm audit toàn bộ có 13 moderate ở công cụ dev; production 0. Cần xử lý hoặc báo blocker cụ thể, không `audit fix --force` hạ major Firebase CLI.
- Chưa xác nhận staging/PITR production; không đọc hay tải database production. Dùng browser profile mới và Firebase emulator. Bản backup test được xuất/restore trong môi trường giả lập.
- Production hiện hữu là `https://avilog.up.railway.app`/Firebase `avilog-atpl`; đọc health/config không phải xác nhận Navy V2 đã deploy. Không merge/deploy theo đặc tả mới; bàn giao PR để review.

## Bằng chứng và hướng dẫn phát hành

Đã triển khai bản review trên nhánh riêng. **Chưa merge/deploy; đã đối chiếu bố cục 12 ảnh, chờ chủ dự án review trực quan.** Preview local tại `http://127.0.0.1:4173`, tắt account/workspace/evidence/admin server flags, dùng kho khách theo origin. Đây không phải staging có OAuth thật.

### Thành phần đã tích hợp

- Bộ token chung áp dụng cho app chính, thư viện và giao diện ngoài của ngân hàng Ôn thi; Navy mặc định cho người chưa chọn theme, giữ lựa chọn sáng/tối đã lưu theo UID. Card 24 px, control 16 px, safe-area và reduced motion. Màu accent chữ tối dùng `#5eead4`, muted dùng `#c6d2e3` để đủ tương phản trên card; màu action bổ sung giữ token `#24b8a0`.
- Font native của thiết bị ưu tiên, Inter đã cài vẫn là fallback. Không tải font stylesheet từ Google trên đường tải token offline. CI đầu tiên gặp timeout Weather readiness ở WebKit/Linux; bỏ phụ thuộc font bên ngoài và thêm readiness diagnostics, giữ nguyên timeout/assertions để chạy lại xác minh.
- Flight Card có gradient Navy, header ngày/flight/function từ phân bổ thật, Block ở giữa route, Flight riêng, timeline Init–Dep–Arr minh họa không tỷ lệ, Month Navigator gọn, Search, empty state và tổng tháng UTC. Ảnh Wader 2552 hiển thị Flight 04:17/Block 04:43, còn thẻ 2548 lấy 04:43 ở giữa: Avilog ghi rõ **BLOCK** ở vị trí này để tránh nhầm với airborne. Draft không đóng góp Actual; thống kê phụ nằm dưới danh sách.
- Bộ lọc full-screen có count thật và reset: tháng/tất cả/date range, confirmed/pending/incomplete, aircraft, tail, airport IATA/ICAO, crew, PF/PM, PIC/SIC, IFR/VFR, Day/Night/Instrument theo phút đã ghi, min/max Block. Bộ lọc chỉ ở bộ nhớ; reset khi đổi UID, giữ khi quay lại màn hình trong cùng phiên.
- Danh sách tải 80 thẻ/lần thay vì dựng 10.000 DOM nodes. Tổng/count luôn tính trên toàn bộ kết quả. Đây là phân trang tăng dần, không phải virtual scroll liên tục.
- More mobile điều hướng tới tất cả chức năng hiện có; sidebar desktop giữ các mục đầy đủ. Pill bốn destination thực có, Add tròn nằm bên ngoài bên phải như ảnh. Add mở form thật; không dựng News/Alert/Multi-sector chưa có API chỉ để bắt chước ảnh 2558. Quản lý Logbook là sheet có hàng icon/list và divider, Escape/native focus trap, click ngoài và vuốt handle.
- Ba gạch và avatar chỉ mở Tài khoản & Đồng bộ: trạng thái workspace từ controller thật, login/logout, sync, conflicts và lối vào backup/restore hiện có. Không tạo trạng thái sync giả theo từng flight hoặc thời điểm cloud cuối chưa có dữ liệu nguồn.
- Flight Editor giữ Log/Airports/Tools, Departure/Arrival hai cột và từng ngày UTC; Flight/Block nổi bật ngay dưới mốc giờ, Takeoffs/Landings hai cột; thêm counter 0–20 trên field V14 có sẵn, trạng thái Save/disabled/saving/error và cảnh báo bỏ nháp. Note-only save giữ nguyên Scheduled thiếu route keys, không tự thêm field chỉ do placeholder. Sửa cue nét đứt câu sai trong dialog ATPL mà không sửa engine/answer key.

### Kết quả kiểm chứng

| Kiểm tra | Kết quả |
| --- | --- |
| Build Firebase | Đạt; SDK output/manifest không đổi |
| Unit/API | **295/295 đạt**, gồm 7 ca Navy mới |
| Shared UI | **250 checks đạt**, Chromium/WebKit, 320/390/820/1440, sáng/tối, main/ATPL/quiz/offline |
| Navy Editor | **18 checks đạt**, contrast/focus/overflow/tabs/offline |
| Scan shortcuts | **18 checks đạt**, đúng record, FINAL guards, không tự lưu preview, offline |
| Navy E2E | **8 cấu hình browser×viewport đạt**: search/count/filters/month, account backup, sheet Escape/swipe, discard warning, save/reload và UTC qua ngày, double-submit, counter; không runtime error |
| Auth/Firestore rules | **12 + 18 đạt** |
| Storage/evidence rules | **4 đạt** |
| SDK Auth/Firestore/Storage emulator | Chromium/WebKit đạt same/different UID, guest separation, field merge/conflict, mất receipt, native IDB abort, byte ảnh, backup integrity, parser/file callback và đổi tài khoản; pull/archive/reassign 10.000 chuyến |
| Workspace UI | Chromium/WebKit, 390/1024, cached-UID isolation, guest preservation, form guard, Settings/More và background metadata đạt |
| PWA upgrade | v5→current và pre-Navy-main→Navy trên Chromium/WebKit đạt: actual controlling worker, pending operations, bookmark/bank/source image và cold offline |
| Weather view / TAF attention | Các suite hiện có đạt, cùng raw report/keyword/offline guards |
| PDF.js import / ATPL bank source-offline / admin UI | Các suite hiện có đạt |
| Syntax | 110 file app/lib/scripts JS/CJS/MJS hợp lệ; không thay thế lint/typecheck |
| Git whitespace / protected modules | Đạt; không diff các module model/schema/storage/auth/calculations/API/rules/bank bytes |

Native upgrade harness trước đây tham chiếu Git object không tồn tại `5a47d5a` và kỳ vọng cache cũ. Đã giữ test thật bằng snapshot worker v5 từ published commit `17a2b00`, cùng worker main `4e93e03`; provenance tại `tests/fixtures/workers/README.md`. Kiểm thử dùng worker lịch sử với app assets hiện tại, không giả vờ mô phỏng toàn bộ UI lịch sử.

Kết quả có phạm vi rõ trong [UI-QA.json](navy-v2/UI-QA.json) và [SYNC-QA.json](navy-v2/SYNC-QA.json). Trường commit trong SYNC-QA ghi HEAD nền khi working tree đang thử nghiệm; không phải tuyên bố bản main chưa sửa đã chạy tính năng Navy. Hash ngân hàng 6.426 câu và engine được kiểm tra giữ nguyên.

Performance local Chromium 390 px: các mẫu 100/1.000/10.000 chuyến được ghi trong UI-QA; 10.000 bản ghi chỉ dựng 80 thẻ ban đầu. Số đo là môi trường desktop giả lập viewport, không phải cam kết tốc độ trên iPhone thật hoặc đo memory leak kéo dài.

### File thay đổi và interface

- UI mới: `public/ui/navy-v2.js` (pure view models/renderers + native sheet lifecycle), `navy-v2.css`; function inputs là records/people/month/query/filter state/limit, không gọi storage hoặc API.
- Nối app: `public/app.js`, `workspace/ui.js`, `lib/flight-editor.js`, `lib/appearance.js`, `index.html`, `ui/tokens.css`, `ui/system.css`, `sw.js`.
- Checks/CI: `tests/navy-v2.test.js`, `tests/v14-build-cache.test.js`, `tests/workspace-service-worker.test.js`; `scripts/verify-navy-v2.cjs`, `verify-shared-ui.cjs`, `verify-navy-teal.cjs`, `verify-visible-flight-scan.cjs`, `verify-workspace-ui.cjs`, `verify-workspace-upgrade.cjs`, `app-layout-qa.cjs`, `ui-controls.cjs`; worker fixtures; `package.json` và CI workflow. Script assertions được chuyển sang control mới, vẫn giữ contrast, count, guard và offline checks.
- Evidence: tài liệu này, `docs/navy-v2/` chứa ảnh before/after và QA JSON. Không đưa ảnh gốc Wader hoặc backup tài khoản thật lên repo.

### An toàn dữ liệu

Không đọc/copy database production, không có production record-count/PITR claim. Không deploy rules, không đổi OAuth/origin/flags, không seed account thật. Tests dùng dữ liệu tổng hợp và account emulator. Note-only edit→Save→Reload kiểm tra ID, số record, Actual và Scheduled không đổi; test qua ngày kiểm tra OUT `2026-10-31T23:50:00.000Z` đến IN `2026-11-01T01:10:00.000Z`, Block 80/Flight 60, Instrument nhập riêng 25. Hai requestSubmit liên tiếp chỉ lưu một record.

### Blocker và giới hạn còn lại

1. Đã nhận và đối chiếu 12 ảnh tham chiếu; chưa có nghiệm thu từ chủ dự án và không tuyên bố pixel-perfect. ZIP prototype chưa được chuyển sang đây, nên không có tuyên bố đã tái dùng mã trong ZIP. Ảnh nguồn chỉ đọc tại Downloads, không được đưa lên public repo; bảng dưới ghi rõ các khác biệt chức năng.
2. `npm audit` toàn bộ: **13 moderate**, production `--omit=dev`: **0**. Advisory [minimatch](https://github.com/advisories/GHSA-g3hv-75wg-m249) yêu cầu 11.0.1; [glob](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4) yêu cầu 14.0.2. Metadata npm của Firebase CLI latest 15.34.2 vẫn yêu cầu glob `^10.5.0` và minimatch `^3.0.4`; override major toàn cây chưa chứng minh tương thích với các caller cũ. Không hạ Firebase CLI theo `audit fix --force`, không bỏ cổng audit khỏi CI. **CI audit có thể đỏ và chặn merge** cho đến khi có phương án vá công cụ tương thích. Không tuyên bố security sign-off.
3. Repo chưa có ESLint/TypeScript config hoặc scripts lint/typecheck. Chỉ có syntax check, unit, build và browser evidence; không ghi kết quả lint/typecheck giả. Docker không có trong môi trường local; container smoke chỉ có thể chạy trên CI.
4. Chưa kiểm tra OAuth Google thật, sync hai thiết bị vật lý, bàn phím/safe-area trên iOS thật hoặc staging/PITR. SDK emulator/WebKit desktop không thay thế các bước này.
5. Không thêm các field/API chưa có backend nêu ở phần audit. Không có phân loại từng record đã cloud-sync khi controller chỉ cung cấp trạng thái workspace. Không vẽ trạng thái thành công giả trên thẻ.

### Ảnh trước / sau và đối chiếu phạm vi tham chiếu

Ảnh là dữ liệu giả lập local, không phải tài khoản production. Ảnh before là giao diện repo trước thay đổi, **không phải ảnh Wader**.

| Tham chiếu theo đặc tả | Bản Avilog để review | Trạng thái |
| --- | --- | --- |
| `IMG_2548.PNG` · Logbook overview | [iPhone 390](navy-v2/after/chromium-390-logbook.png) | Header/search, nhóm tháng, card Navy, pill + Add ngoài; không banner quảng cáo hoặc dữ liệu chuyến từ ảnh |
| `IMG_2549.PNG` · Dense cards/month header | [Logbook](navy-v2/after/chromium-390-logbook.png) | Thẻ bốn hàng gọn, timeline và total; thiếu function nhập riêng hiển thị —, không suy SIC chỉ từ PM |
| `IMG_2550.PNG` · Cross-month scrolling | [Desktop](navy-v2/after/chromium-1440-logbook.png) | Chế độ Tất cả tháng và tổng riêng từng tháng; giữ thứ tự ascending của Avilog, không đổi dữ liệu để khớp thứ tự ảnh |
| `IMG_2551.PNG` · Management | [Sheet](navy-v2/after/chromium-390-management.png) | Hàng icon, divider, handle; chỉ Export/Import/Statistics/Backup/Settings/Scan thực có, không PRO gate giả |
| `IMG_2552.PNG` · Identity/times/counters | [Editor](navy-v2/after/chromium-390-editor.png) | [Identity](navy-v2/after/chromium-390-editor.png), UTC mỗi event, Departure/Arrival, Flight/Block và [counters](navy-v2/after/chromium-390-editor-counters.png); giữ nhập ngày để tránh tự rollover |
| `IMG_2553.PNG` · Conditions | [Allocations](navy-v2/after/chromium-390-editor-allocations.png) | PIC/SIC/IFR/VFR/Instrument/Cross-country bằng phút hiện có; không default Instrument 100%, không tạo Stick/Rest/Approach giả |
| `IMG_2554.PNG` · Procedures | [Airports](navy-v2/after/chromium-390-editor-airports.png) | Chưa có schema/source runway/SID/STAR/threats; tab Airports giải thích, không tạo control không lưu được |
| `IMG_2555.PNG` · Time summary | [Summary](navy-v2/after/chromium-390-editor-summary.png) | Summary dùng cùng hàm tính Avilog; không tự tính NM, không tạo Next/Return/Share chưa có nghiệp vụ |
| `IMG_2556.PNG` · Filters top | [Filters](navy-v2/after/chromium-390-filters.png) | Close trái/Clear phải, Navy rows, period/status/aircraft/tail/airports/crew; SIM vẫn ở Duty |
| `IMG_2557.PNG` · Filters bottom | [Filters](navy-v2/after/chromium-390-filters.png) | Rules/conditions theo phút thực, giới hạn Block phút chính xác và count cố định dưới; không đổi thành tín dụng IFR từ ảnh |
| `IMG_2558.PNG` · Add menu bổ sung | [Logbook](navy-v2/after/chromium-390-logbook.png) | Add ngoài pill mở New Flight có thật; SIM/training vẫn có trong Lịch bay/Duty, không thêm News/Alert chưa triển khai |
| `IMG_2559.PNG` · More bổ sung | [Sheet](navy-v2/after/chromium-390-management.png) | More là menu điều hướng các mục Avilog có thật; account/sync vẫn riêng ở ba gạch, không sao chép Wader PRO/friends/tools |

[Before repo](navy-v2/before/chromium-dark-logbook.png) là ảnh local trước thay đổi, không phải Wader. Các ảnh after dùng record tổng hợp của kiểm thử; ảnh gốc Wader và lịch sử bay trong đó không được seed hoặc publish.


### Kiểm tra thủ công trước phê duyệt

1. Mở local preview, chọn Logbook; kiểm tra nhãn dữ liệu mẫu, thẻ và UTC. Đổi tháng, tìm flight/crew, kết hợp filter và kiểm tra count; Close giữ lựa chọn, Clear xóa filter.
2. Mở More để tới Crew/Statistics/Settings/Ôn thi, kiểm tra Weather/TAF. Ba gạch không điều hướng chức năng; backup/restore dẫn tới phần dữ liệu của workspace đang chọn.
3. Trên staging được cấu hình riêng, dùng tài khoản thử: note-only edit một chuyến đã FINAL, reload và so ID/Actual/Scheduled. Thử mất mạng rồi sync từ hai thiết bị thử; không dùng account production để seed record.
4. Tạo flight thử qua ngày UTC, nhập Instrument/PIC/SIC riêng, lưu hai lần và kiểm tra không trùng. Sửa Actual FINAL phải được phép rõ ràng; ảnh preview chưa xác nhận không tự ghi dữ liệu.
5. Xuất backup thử, kiểm tra đủ part/ảnh và phục hồi vào kho thử; xem preview/collision trước xác nhận. Thử account khác không thấy dữ liệu.
6. Review bảng đối chiếu 12 ảnh và screenshots after; kiểm tra tap/focus/keyboard trên iPhone/iPad thật, xác nhận các khác biệt do phạm vi model trước merge.

### Deploy và rollback (chưa thực hiện)

Chỉ phát hành sau khi visual review, security/tooling gates, staging và phê duyệt hoàn tất. Xác nhận Railway project/service/environment, nhánh deploy, origin `https://avilog.up.railway.app`, Firebase project `avilog-atpl` và backup/PITR do chủ hệ thống quản lý. Không thay Firebase rules/flags chỉ để phát hành UI. Build theo Dockerfile hiện có; kiểm tra health, shell/assets và đúng commit sau deploy. Người dùng đóng/mở PWA online, không xóa site data.

Nếu cần rollback UI sau một lần deploy đã được phê duyệt: chọn lại artifact/commit nền `4e93e03446b15d866155e7a16da8927a32163df5` trên cùng Railway service/environment; xác minh fingerprint/assets/health và mở lại PWA online. Không revert database, reset UID, xóa IndexedDB/outbox hoặc nhập đè backup. Schema/SDK bundle không đổi trong PR này; nếu có dữ liệu chờ gửi, giữ nguyên để controller xử lý sau cập nhật.

## Follow-up: Ôn thi đồng bộ với Avilog

Thư viện và từng môn dùng chung navigation, sidebar/mobile More, header, theme và menu tài khoản; xem [thay đổi và bằng chứng kiểm thử](STUDY-SHELL.md). Bộ đề, key, tiến độ và các định dạng lưu trữ giữ nguyên. UI mở lại theo generation mới nhất nếu tài khoản đổi trong lúc boot; không nới quyền ghi của phiên cũ.
