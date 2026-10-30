# AviLog V14

**Bản sửa bảo mật và CI 31/10/2026:** [thay đổi và kiểm chứng](docs/SECURITY-CI-2026-10-31.md). Unit/API: **275/275 đạt**; các bộ rules emulator: **34/34 đạt**; `npm audit` không còn cảnh báo tại thời điểm kiểm tra. Kết quả này là kiểm thử cục bộ, không xác nhận đã triển khai lên Railway.

**Hướng dẫn phát hành V14:** [docs/V14-HUONG-DAN.md](docs/V14-HUONG-DAN.md). Giữ nền V13 Compact và Smart Scan V2. Bổ sung Quick Entry, đối chiếu scan, lịch sử FINAL và các trường giờ thủ công.

**Quan trọng:** dùng Google cần build SDK khớp mã nguồn + triển khai Firestore rules + bật `AVILOG_LOGBOOK_V14_ENABLED=true`. Dockerfile thực hiện bước build; SDK đính kèm cũng đã được build lại cho bản sửa 31/10. Khi khóa tắt, tài khoản vẫn ở chế độ tương thích V13; khách dùng V14 cục bộ. Không có dữ liệu bị reset. Bản sửa này chưa triển khai Railway.

**Lịch sử bàn giao 24/10:** số liệu 224 đạt / 5 lỗi và 89 kiểm tra Chromium trong hướng dẫn là kết quả của bản bàn giao cũ; xem báo cáo 31/10 ở trên cho bản sửa hiện tại. Chưa có kiểm chứng mới trên cloud, Docker hoặc thiết bị vật lý.

---

## Tài liệu nền và các bản trước (giữ để tham khảo)

# AviLog · Pilot Logbook preview

**Bàn giao mã nguồn / tự chạy và đưa lên GitHub:** xem [HUONG_DAN_BAN_GIAO.md](HUONG_DAN_BAN_GIAO.md).

Mobile-first personal pilot logbook PWA, in Vietnamese with aviation labels. Built for iPhone, iPad and desktop. Guest mode needs no login. Data is saved first in this browser's IndexedDB. When whole-app sync is enabled, the selected Google account has a separate local workspace and can synchronize records through private Firestore and original evidence bytes through private Firebase Storage. The public web server does not receive logbook, roster or evidence uploads. Export backups before clearing website data or moving to a different website origin.

## Run

Node >=24.12:

```sh
npm ci --ignore-scripts
npm test
npm start
```

Open `http://localhost:3000`. Docker/Railway uses `Dockerfile` and `/api/health`. `PORT` is supplied by Railway; default 3000. No secrets or database required. `/api/weather` uses the public NOAA Aviation Weather Center API through a backend provider with a five-minute cache and eight-second timeout. Station must be a four-letter ICAO. Reports are for situational awareness, not official operational briefing.

## Try it

The first visit loads clearly labelled October 2026 demo data from the product brief. Crew names are fictional. `09/10` has VN7388, VN7389, VN1186 and VN1187. VN0605 on 06/10 contains the supplied A320 actual example (04:29 / 04:39 / 05:50 / 06:00), 01:11 airborne and 01:31 block. VN0343 has supplied OUT/IN crossing 03→04 October and remains an unconfirmed draft because OFF/ON were not supplied. Demo DAY OFF is illustrative.

- **Lịch bay:** month/list calendar, selected-day detail, duty editor, METAR/TAF.
- **Logbook:** Scheduled and Actual independently, explicit UTC dates on every event, role/crew/registration, takeoff/landing performer, landing mode, PIC/SIC and manual night minutes, evidence attachment, source and confidence. Confirmed Actual changes need an explicit replacement checkbox.
- **Import roster:** PDF text extraction with PDF.js, editable raw text, editable preview, explicit confirmation. Reimport identity = UTC flight date + flight number with leading-zero normalization. Scheduled route/times update; confirmed operational route, aircraft and source stay intact; Actual never changes; missing flights are never silently deleted. Real monthplan.pdf was not available in synced sources for layout validation. Supported normalized rows:

```text
09/10 VN7388 SGN-DLI 07:14-08:06
VN7389 DLI-SGN 08:40-09:30
VN1186 SGN-HPH 10:52-12:57
VN1187 HPH-SGN 13:40-15:32
```

  Use month/year selector. Other layouts require correcting extracted text to this format. Image-only PDFs are not silently interpreted; an error asks for manual entry. Review unknown lines against the original.
- **Smart Scan V2 A320/A321 (22/10/2026):** tự tìm vùng màn hình MCDU tối có ký tự xanh, tăng tương phản cục bộ, OCR ảnh đã cắt trước và chỉ thử thêm toàn ảnh khi thiếu trường; chạm/kéo khoanh vùng và đọc lại thủ công. Parser nhận hàng `FLT ID/DATE — DEPT/DEST`, loại trừ tên cột, hỗ trợ `ZGGG → CAN`, nhận các ký tự OCR dễ nhầm trong Flight ID/time kèm cảnh báo; kiểm tra `FLIGHT = ON−OFF`, `BLOCK = IN−OUT`. Chỉ gợi ý; ngày UTC, route, giờ và ký tự đã sửa vẫn phải xác nhận trước khi lưu. Ảnh gốc được giữ nguyên, không gửi ảnh tới OCR cloud. Không có tuyên bố OCR chính xác 100% hoặc đã thử trên mọi máy bay/thiết bị.
- **Nhập từ ảnh:** Tesseract OCR runs locally; first use downloads the English model. JPEG/PNG/WebP ≤6 MB. A320/A321 parser recognizes flight number, ICAO route and OUT/OFF/ON/IN. Review/correct all fields before confirming. B787/A350/other families explicitly require manual entry until a validated parser is added. Example button only loads the supplied sample text and never pretends to read the user's image.
- **Crew Book:** fictional sample profiles, per-flight Captain/FO/additional crew, confirmed sectors/block and last route, history.
- **Statistics:** confirmed actual block, airborne, sectors, PF/PM, takeoff/landing, manually entered night/PIC, SIC remainder, aircraft, airport and crew. SIM/training/positioning activities do not contribute flying hours.
- **Duty:** explicit report/release, same-day auto grouping with explicit exclusions, multiple activities per date, previous-duty rest and overlap indication, standby/reserve/day off/positioning/SIM/training. FTL engine scaffold is versioned; no Vietnam Airlines limits are installed and UI says **not evaluated**. Colored chips in source dialog are explanatory examples only.
- **Settings:** profile, reminder preferences, report lead time, backup JSON (including images), validated merge restore and CSV escaping spreadsheet formulas. Restore preserves existing confirmed actuals, existing crew/duty IDs and local reminder settings. Flight/duty removal uses a recoverable Trash in Settings.
- **PWA:** install manifest/icons, versioned cache-first static shell and downloaded banks. Private data, weather API and OAuth requests bypass the public service-worker cache. Local data remains available offline; initial OCR model download needs internet. Only raw METAR/TAF text for the departure/arrival airports and UTC flight day is retained with source/retrieval time; old/future flights never acquire today’s weather as historical evidence.

## Ôn thi ATPL và học offline

Trong Pilot Logbook chọn **Ôn thi**. Có 11 bộ đề gốc, tổng **6.126 câu**, và **300 câu Mass & Balance tham khảo** ở bộ MBR riêng. Câu hỏi, lựa chọn, UID, đáp án gốc và bộ máy chấm thi được giữ nguyên từ bản ATPL đã bàn giao. Lời giải, cảnh báo xung đột/thiếu căn cứ và ảnh trích nguồn được chuyển nguyên trạng; tích hợp này không tạo thêm kết luận kiểm định.

Trên iPad mở app bằng Safari khi có mạng, chọn **Tải offline** cho từng môn và chờ **✓ Sẵn sàng offline**. Có thể thêm app vào Màn hình chính qua menu Chia sẻ. Sau khi tải đủ, câu hỏi, lời giải và ảnh nguồn của môn đó dùng được khi mất mạng. Chọn câu, tiếp tục học, bookmark, thi thử, ngày/đêm và xuất/nhập tiến độ vẫn hoạt động. Bộ MBR tham khảo có tiến độ và đáp án riêng; luyện thi theo đáp án gốc dùng MB.

Mỗi môn hiển thị dung lượng trước khi tải. Có thể dừng rồi tiếp tục; phần đã tải được kiểm tra và dùng lại. App kiểm tra byte và SHA-256 của từng tài nguyên, chỉ đánh dấu sẵn sàng sau khi lưu đủ. Thiếu ảnh, mất mạng hoặc hết dung lượng sẽ giữ trạng thái chưa hoàn tất. Cập nhật service worker giữ cache đề và dữ liệu logbook. Không xóa dữ liệu website nếu muốn giữ đề offline và tiến độ; xuất bản sao lưu riêng cho logbook và ATPL trước khi đổi thiết bị. Dữ liệu khách không tự nhập vào tài khoản. Dữ liệu tài khoản Google chỉ sang thiết bị khác sau khi đồng bộ khi có mạng; ảnh minh chứng cần được tải riêng trên máy muốn dùng offline. Các liên kết website ngoài, thời tiết và lần tải đầu cần mạng.

Nguồn đóng gói: SHA-256 `28fbacae42e5b05023c89b077d977e62184a2e916da0dc7d14bd521acd89239f`. `scripts/package-atpl.py` tạo HTML từng môn, catalog và manifest từ app nguồn; `data/atpl-media/` chứa ảnh base64 chia gói, được `lib/atpl-media.js` phục vụ theo URL hash. Ảnh được dùng chung giữa các môn, không lưu toàn bộ thư viện ảnh vào RAM máy chủ.

Kiểm thử: `npm test` và `node scripts/verify-atpl-browser.cjs`. Chromium kiểm tra với offline flag; WebKit kiểm tra khi toàn bộ kết nối tới máy chủ bị từ chối do [lỗi mô phỏng offline của Playwright WebKit #42775](https://github.com/microsoft/playwright/issues/42775). Cả hai mở/chấm đủ 6.426 câu, đọc ảnh nguồn offline, khôi phục backup và giữ nguyên IndexedDB logbook. Chưa kiểm tra trực tiếp trên iPad vật lý. Báo cáo máy chạy được ghi trong `test-results/atpl/Browser_QA.json`.

## Tài khoản Google và đồng bộ ATPL

Tính năng đăng nhập **mặc định tắt trong cấu hình mã nguồn**. Bản công khai hiện đã bật Google: đăng nhập Safari và chuyển bookmark từ điện thoại sang iPad được người dùng xác nhận ngày 20/10/2026. Người học vẫn dùng chế độ khách và học các môn đã tải khi offline. Lần đăng nhập Google đầu tạo tài khoản; app không xin quyền đọc Gmail, Drive hoặc Calendar.

Khi tính năng được kích hoạt:

1. Điện thoại và iPad dùng **cùng tài khoản Google**. Đăng nhập lần đầu cần mạng.
2. Trên máy cũ, bấm **Đồng bộ ngay** và chờ **Đã đồng bộ** trước khi mở máy khác. Dữ liệu chưa gửi không thể tự xuất hiện ở máy khác.
3. Trên máy mới, đăng nhập và đồng bộ rồi tải offline các môn muốn học. Mất mạng vẫn lưu tiến độ riêng của tài khoản đã chọn; mở lại app khi có mạng để gửi phần đang chờ.
4. **Xem / nhập tiến độ khách** cho xem số câu và yêu cầu xác nhận riêng từng môn. Bản sao trước khi nhập được tải xuống, dữ liệu khách vẫn giữ nguyên. Lượt cũ trùng nhau lấy giá trị lớn hơn, không tự cộng thành các lượt độc lập. Bản sao trước nhập vẫn có định dạng JSON v2 để khôi phục; `sourceOriginal` giữ bản nguồn đi kèm.
5. Đăng xuất về kho khách; các tài khoản có kho riêng. Tab cùng tài khoản/môn chỉ có một tab ghi. Trình duyệt thiếu Web Locks chỉ xem/xuất kho tài khoản; chế độ khách vẫn dùng được.

**Xuất tiến độ** trong Cài đặt của môn tạo bản JSON có thể nhập lại. **Xuất bản lưu tài khoản** giữ cả thông tin phục hồi đồng bộ; đây là bản kỹ thuật để xử lý sự cố. Nếu báo chưa lưu được, hãy xuất tiến độ trước khi đóng. Đặt lại tiến độ tài khoản cần xác nhận và tạo phiên dữ liệu mới; bản chờ từ phiên cũ được giữ để xuất khi báo xung đột. Không sửa thủ công UID, baseline hoặc lô đang gửi.

Khi bật đồng bộ toàn app, hồ sơ, logbook, lịch/duty, crew, cài đặt nhắc việc và thùng rác cũng có kho riêng theo Google UID. Ảnh gốc dùng Firebase Storage khi cờ ảnh được bật. Quyền thông báo và trạng thái tải offline vẫn riêng từng thiết bị. Không có đồng bộ ngầm khi iOS đã đóng app. Xóa dữ liệu website cũng xóa bản tải offline; giữ sao lưu trước khi xóa hoặc đổi địa chỉ website.

### Đồng bộ toàn app và ảnh offline

Dùng cùng Google trên điện thoại và iPad. **Đồng bộ ngay** gửi dữ liệu đã lưu trên máy; kiểm tra riêng trạng thái logbook, ảnh và Ôn thi. Một môn chưa được kiểm tra không có nghĩa toàn bộ môn đã đồng bộ. Khi có xung đột, xem hai phiên bản rồi chọn rõ ràng; thời gian thiết bị không tự quyết định bản thắng.

Trong **Settings → Dữ liệu tài khoản & ảnh offline**, chọn **Tải ảnh để dùng offline** trên máy mới và chờ đủ số ảnh. App kiểm tra byte/SHA-256, không tự tải mọi ảnh khi mở. Ảnh gốc JPG/PNG/WebP tối đa 6 MiB, không nén hoặc chụp lại thời tiết. Mất mạng vẫn giữ ảnh và thay đổi chưa gửi trên máy.

**Xuất backup đầy đủ ảnh** tạo các phần JSON tối đa 50 MiB. Giữ đủ mọi phần cùng bộ; thiếu ảnh/phần hoặc sai hash không được gọi là khôi phục đầy đủ. Có bản xuất thiếu ảnh và bản phục hồi riêng khi cần cứu dữ liệu. Backup Ôn thi giữ riêng trong Cài đặt từng môn. Khôi phục dữ liệu cũ có xem trước, bảo toàn nguồn và Actual đã xác nhận; không tự phát lại các operation cũ từ một gói phục hồi.

`AVILOG_WORKSPACE_SYNC_ENABLED` và `AVILOG_EVIDENCE_SYNC_ENABLED` mặc định `false`; ảnh cần cả workspace và bucket. Tắt cờ vẫn giữ kho tài khoản/local queue/ảnh/phục hồi. Rollback phải dùng build có namespace mới; không quay về build chỉ có một kho chung và không xóa bucket/dữ liệu để rollback. Xem [kiểm thử toàn app](docs/workspace-verification.md).

### Cấu hình cho chủ ứng dụng

Dùng đúng dự án chủ ứng dụng `avilog-atpl`, Google provider và Firestore Standard `(default)` tại `asia-southeast1`; không tạo dự án thay thế. Thêm hostname Railway đang thực sự sở hữu vào Firebase Authorized domains, OAuth JavaScript origins và `https://<hostname>/__/auth/handler`. Đồng bộ ảnh cần Blaze và bucket riêng tư cùng vùng Singapore; không bật Analytics/Gemini/Functions hoặc public sharing. Chọn billing account và cảnh báo ngân sách do chủ ứng dụng xác nhận; cảnh báo không tự giới hạn chi phí. Cấu hình phát hành thực tế nằm trong `docs/WORKSPACE-Account-QA.json` khi có.

Triển khai `firebase/firestore.rules` và indexes trước khi bật tính năng. CLI cần phiên đăng nhập của chủ dự án (không đưa service-account key vào repo/browser):

```sh
firebase deploy --only firestore:rules,firestore:indexes --project <project-id>
```

Cấu hình Railway theo `.env.example`: `ATPL_APP_ORIGIN` là HTTPS origin chính xác; `FIREBASE_PROJECT_ID`, `FIREBASE_API_KEY`, `FIREBASE_APP_ID` là cấu hình web công khai. `authDomain` tự lấy từ origin, còn proxy `/__/auth/` chỉ chuyển tới `<project-id>.firebaseapp.com`. Không dùng `ATPL_USE_EMULATORS=true` trên bản thật. Chỉ đặt `ATPL_ACCOUNTS_ENABLED=true` trong cửa sổ kiểm thử OAuth thật sau khi các kiểm thử/rules đã qua; nếu lỗi, tắt lại cờ và giữ nguyên dữ liệu.

`npm run build:atpl-account` đóng gói SDK Firebase tại cùng origin, không tải SDK từ CDN khi học. `npm run test:rules` kiểm thử các luật/giao dịch với Auth/Firestore emulator. `npm run test:account-browser` kiểm thử SDK thật, hai thiết bị mô phỏng, Google emulator, mất mạng/mất xác nhận và đổi tài khoản. Đây không phải bằng chứng OAuth Google thật hay iPad vật lý; xem [báo cáo kiểm thử](docs/account-verification.md).

Địa chỉ từ ngày 20/10/2026: **https://avilog.up.railway.app/**. Railway đã xác nhận quyền sở hữu; Google OAuth, Firebase Authorized domains và CORS đã chuyển sang địa chỉ này theo phê duyệt của chủ ứng dụng. Địa chỉ preview cũ đã được thay thế. Người dùng đã xác nhận đăng nhập Google trên Safari của Mac; kiểm chứng đồng bộ toàn app/ảnh và iPad thật được ghi riêng trong báo cáo QA. Đổi origin không tự chuyển localStorage/IndexedDB/cache: đăng nhập cùng Google để nhận dữ liệu đã đồng bộ, nhập backup đối với phần chỉ lưu trên máy, rồi tải lại môn/ảnh cần dùng offline.

## Preview limits

Guest data remains browser-local. Optional whole-app Google synchronization is independently controlled by workspace/evidence feature flags. A cached UID selects its local workspace but never authorizes cloud access. A new account starts empty; existing guest data is imported only after preview and explicit confirmation. Production activation and physical-device evidence are recorded separately. Notifications/reminder checks run **while app is open**; no closed-app push. Tomorrow and evening preferences are UTC. Night time is manual; no unverified night calculator. No FTL compliance claim; a validated ruleset with version/effective date/source is required. Missing roster entries are retained for review, not treated as cancellations. Same flight number operated twice on one UTC date requires a future occurrence identifier and manual review.

## Architecture and extension

`public/account/`: shared account client/coordinator. `public/workspace/`: canonical records, native UID repository, causal outbox/receipts/conflicts, bounded pull, Session/UI, original image transfers and multipart backup. `public/lib/domain.js`: UTC, validation, merge, totals, backups and reminders. `parsers.js`: roster and aircraft-family registry. `rules.js`: pure versioned engine. `storage.js`: atomic IndexedDB transactions. `importers.js`: PDF/OCR adapters. `app.js`: browser UI. `lib/weather.js`: provider/cache adapter. `server.js`: static assets, health and weather API. To add aircraft support, register a parser and fixtures first. Add no airline rule without reviewed source provenance.

Specs/plans and verification notes live under `docs/`. No uploaded company PDFs or sensitive credentials are included in this repository.


## Theo dõi thời tiết và giao diện Ôn thi

Trong **Thời tiết**, thêm/bớt tối đa 40 sân bay bằng ICAO hoặc IATA có hỗ trợ (ví dụ SGN, HAN, BKK). Danh sách theo tài khoản Google đồng bộ như các cài đặt khác; chế độ khách lưu trên thiết bị. Mục theo dõi hiển thị đầy đủ METAR/SPECI, TAF/AMD/COR, giờ phát hành và hiệu lực UTC, liên kết nguồn, lỗi cập nhật và bản đã lưu. Tự cập nhật mỗi 5 phút khi đang mở, có nút cập nhật thủ công. Bản chữ gần nhất giữ trên máy để mở lại offline; trên máy mới cần mở mục này có mạng để tải bản tin. Backup tài khoản giữ danh sách sân bay; cache bản tin theo dõi là dữ liệu riêng từng thiết bị. Bản gắn chuyến bay vẫn chỉ gồm sân bay đi/đến của ngày UTC tương ứng.

Nguồn ưu tiên, khi cấu hình credential: Tan Son Nhat MET Office tại `https://118.69.213.84`; METAR dùng `index.php?cat=1&sub=6`, TAF dùng `index.php?cat=2&sub=0`. Máy chủ đăng nhập bằng biến môi trường `MET_OFFICE_USERNAME` và `MET_OFFICE_PASSWORD`; không lưu mật khẩu/cookie trong repo, HTML, public config, backup hoặc log. Chỉ kết nối HTTPS có chứng chỉ hợp lệ; không hạ xuống HTTP, không bỏ kiểm tra TLS, không gửi credential sang origin khác khi redirect. Nếu nhà cung cấp không phục vụ HTTPS hợp lệ, ứng dụng dùng NOAA dự phòng. Cookie chỉ giữ trong RAM. Các URL HTTP trong bản tin/backup cũ vẫn đọc được như thông tin nguồn, không được dùng để đăng nhập hoặc tải bản tin mới.

NOAA Aviation Weather Center là nguồn dự phòng theo từng sản phẩm khi nguồn ưu tiên lỗi, thiếu bản tin, METAR quá hai giờ hoặc TAF hết hạn. METAR và TAF có thể lấy từ hai nguồn, mỗi bản có liên kết nguồn thực tế. Giữ bản AMD/COR và SPECI mới nhất theo giờ phát hành. Bản NIL không được coi là bản tin đầy đủ. Đây là hiển thị theo dõi, không thay briefing chính thức.

Đăng nhập, đồng bộ thủ công, nhập dữ liệu khách và khôi phục một môn từ cloud nằm tại **Ôn thi → trang danh sách môn**. Màn hình câu hỏi vẫn tự lưu và đồng bộ nền, giữ nguyên key chấm gốc; không có panel tài khoản chiếm chỗ. Sau cập nhật, tải lại app/đóng rồi mở lại PWA để nhận shell mới; không xóa dữ liệu website khi còn tiến độ chưa gửi.

Kiểm thử riêng: `npm run test:weather-ui` (Chromium/WebKit + offline/cache/UID) và `npm run test:weather-account` (Firebase SDK/Auth/Firestore emulator, hai thiết bị cùng UID, xóa sân bay offline, khác UID, câu trả lời/bookmark tự đồng bộ, phục hồi ở thư viện). Chúng được đưa vào `npm run test:workspace-all`. Emulator và WebKit trên desktop không chứng minh iPad vật lý hay Google OAuth thật cho tính năng mới.

Weather release upgrade: close/reopen every older AviLog tab/PWA and reload online before editing across devices. Do not clear browser/site data. The old v4 strict workspace reader cannot consume the new airport preference or primary-source URL: it stops sync and retains local pending work; it must be reloaded to v5 to resume. This is a required client upgrade, not a claim of mixed-version interoperability. Export a backup if an older tab has unsent work. The v5 reader accepts older records and replays the same pending operations after reload; concurrent reminder edits keep the airport list. ATPL question/answer data and account-bank formats are unchanged.

### Grouped weather and top account toolbar (2026-10-21)

AviLog opens on **Thời tiết**. Create your own groups (for example Quốc nội and Quốc tế), select a group when adding an ICAO/IATA airport, and tap a compact station row to read full METAR/TAF, source and UTC times. Groups expand/collapse. **Sắp xếp** shows rename/delete and ↑/↓ controls; expand a station to remove it, reorder it or move it to another group. Deleting a group asks for confirmation. A station can belong to several groups, and its weather is fetched only once. Limits: 8 groups and 40 distinct airports overall.

Existing flat airport selections remain in **Danh sách hiện tại**, in their original order. Group names, membership and ordering synchronize through the same private Google workspace and its offline outbox. Concurrent edits of the weather selection become a reviewable conflict instead of splitting group membership from its fetch list. Cached weather remains text on each device; offline group creation, moves and reopening do not require screenshots or a live provider. Input drafts and expanded rows survive background renders; account changes reset that view state.

Account login, logout, manual sync and conflict actions now sit in the top toolbar. Detailed image/ATPL status and guest import are under **Chi tiết** there. The ATPL bank question screen keeps its existing background sync and original answer keys.

**Update every device online:** close older AviLog tabs/PWA, reopen and reload (reload once more if the updated view has not appeared). Keep browser/site data. Older strict v5 readers require this upgrade to consume grouped preferences; no mixed-version interoperability is claimed. Native upgrade QA checks v5 worker + legacy flat IDB data/cache/outbox against the v6 reader; it does not emulate every previously loaded v5 JavaScript page.

### Compact weather revision (2026-10-21)

Weather opens with report folders first. **＋ Quản lý** opens group/airport forms and ordering controls; these are closed by default. METAR previews wrap completely rather than truncate. Separate calendar timestamps are omitted from the watchlist presentation; raw report times, stored retrieval metadata and stale/expired/cancelled warnings remain intact. Each folder has one collapsed **Nguồn dữ liệu** section after its stations, deduplicated by the actual product source URL, including mixed primary/fallback sources.

The **⋮** menu at the top right contains Google login, sync, logout-to-guest, conflict review and account details. It closes with Escape or an outside click and preserves its open state across background updates; account changes reset it. Offline data and bank answer keys remain unchanged. Close/reopen older AviLog tabs/PWA online to install shell v7 before using the revised interface; keep site data.

### App-wide navy/white layout (2026-10-21)

The same compact layout applies to Schedule, Logbook, Crew and Statistics: their data stays visible first; creation, import, image import, export and advanced filtering live in **＋ Quản lý**. Settings uses four expandable sections. Main and quiz-library account actions live in **⋮** at the top right. The quiz library keeps subject links visible and places offline downloads in each card's management menu. In a bank, question answers and question navigation remain visible; theme, backup/settings and offline downloads are grouped in **＋ Quản lý**.

White content surfaces, navy text/actions and subtle neutral shadows replace decorative green/amber/red areas. Day/night mode remains available in bank management; correct/incorrect answers retain explicit wording and ✓/× plus solid/dashed borders. `public/atpl/avilog-theme.css` is an external presentation layer, cached with the shared shell. Original bank HTML, question payloads, answer keys, engine bytes, identities and downloaded source illustrations remain unchanged.


### Day/night, compact navigation and E190

Use the sun/moon button in AviLog or the ATPL library to switch all screens between day and night. The quiz theme button and its existing settings dropdown use the same display choice. Theme and compact/collapsed sidebar choices are retained locally per account on each device, including offline. The sidebar defaults to 156 px on desktop, 140 px on tablet; collapse it to 68 px with ☰. Mobile keeps bottom navigation.

Flight Captain, First Officer and other crew fields accept names with live suggestions (including accent-insensitive search). Selecting an existing profile retains its ID; “Tôi” retains the existing self assignment. Unknown exact names create profiles only when the complete flight is successfully saved. Cancelling or failed validation creates no people. Profiles sharing a name remain distinct when selected explicitly. New crew uses the existing private workspace synchronization.

E190 appears in aircraft selection and image import. The supplied E190 ACARS OOOI photo is available as a local example. Image OCR finds the display before recognition, reads paired OUT/OFF and IN/ON columns, and leaves the result unconfirmed for review. Common OUT/OUR and Z/2 substitutions are flagged and lower confidence. The sample's four clocks read OUT 12:30, OFF 13:07, ON 13:33, IN 13:37; its flight number and route still need visual verification/manual correction. The OUT date comes from the date input, never the computer clock. No flight is automatically stored.

First image recognition on a device needs Internet to load the OCR engine and English model. After one successful recognition, public engine assets and the model are cached for offline reopening. The source photo remains unchanged and no OCR cloud service receives it. Manual entry remains available offline. Original ATPL questions, keys, bank identities, scoring and figures are unchanged.


### Numeric UTC flight times

Scheduled OUT/IN and Actual OUT/OFF/ON/IN use separate date and text clock fields. Enter `0714` or `07:14`; the clock displays `07:14` on blur, always UTC 24-hour with no AM/PM. Newly created manual flights and empty event-date fields default to the device's current calendar date; clocks remain blank until entered. Edit dates explicitly for historical flights or midnight crossings. `2400` and invalid minutes are rejected rather than rolled forward.

Existing and OCR-imported event dates/times are retained. If the displayed UTC date/minute has not changed, saving preserves the original timestamp including seconds/milliseconds. Note-only edits to confirmed flights do not replace Actual. The stored format, offline queue and account synchronization remain UTC ISO timestamps as before.


## Flight Detail UI v12 (2026-10-23)

Màn Thêm chuyến / Chi tiết chuyến / Kiểm tra ảnh dùng tab **Log / Airports / Tools**.
Mobile mở toàn màn hình, navy/trắng theo chế độ ngày/đêm. Actual OUT/OFF/ON/IN
xếp hai cột, từng mốc vẫn có ngày UTC riêng. Crew và Scheduled thu gọn; Flight Times
hiển thị Flight/Block/PIC/SIC/Day/Night từ các trường đang có. Nguồn, ảnh, xác nhận
và cho phép thay Actual nằm trong Tools; nút Lưu luôn ở header.

Không thêm trường procedure, dịch vụ tra cứu hoặc myAVES. Không đổi schema/sync,
Firebase rules hay ngân hàng ATPL; giữ Smart Scan V2. Cache shell `avilog-shell-v12-flight-editor`.
Đọc [bản bàn giao UI v12](FLIGHT_UI_V12_RELEASE.md) để áp dụng, xem phạm vi và các giới hạn
kiểm thử. **Chưa triển khai Railway.**

### Flight Detail V13 — medium compact spacing (2026-10-23)

Flight Detail trên iPhone/iPad/Desktop giữ nguyên ba tab Log / Airports / Tools và form hiện có,
nhưng giảm khoảng trống trong header, card và lưới giờ Actual ở mức vừa. Nút Lưu, tab và
chức năng xác nhận/khóa Actual không thay đổi; dữ liệu lưu, nguồn ATPL và rules Firebase
không đổi. PWA shell `avilog-shell-v13-compact`: sau khi triển khai hãy đóng/mở lại app
khi có mạng, **không xóa site data**. Hướng dẫn & QA xem `FLIGHT_UI_V13_RELEASE.md`.
