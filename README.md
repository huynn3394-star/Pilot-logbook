# AviLog · Pilot Logbook preview

Mobile-first personal pilot logbook PWA, in Vietnamese with aviation labels. Built for iPhone, iPad and desktop. No login is required and **records and evidence images stay in this browser's IndexedDB**. Export a JSON backup before clearing website data or changing devices. The public server never receives logbook, roster or evidence files.

## Run

Node 22+:

```sh
npm install --ignore-scripts
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
- **Nhập từ ảnh:** Tesseract OCR runs locally; first use downloads the English model. JPEG/PNG/WebP ≤6 MB. A320/A321 parser recognizes flight number, ICAO route and OUT/OFF/ON/IN. Review/correct all fields before confirming. B787/A350/other families explicitly require manual entry until a validated parser is added. Example button only loads the supplied sample text and never pretends to read the user's image.
- **Crew Book:** fictional sample profiles, per-flight Captain/FO/additional crew, confirmed sectors/block and last route, history.
- **Statistics:** confirmed actual block, airborne, sectors, PF/PM, takeoff/landing, manually entered night/PIC, SIC remainder, aircraft, airport and crew. SIM/training/positioning activities do not contribute flying hours.
- **Duty:** explicit report/release, same-day auto grouping with explicit exclusions, multiple activities per date, previous-duty rest and overlap indication, standby/reserve/day off/positioning/SIM/training. FTL engine scaffold is versioned; no Vietnam Airlines limits are installed and UI says **not evaluated**. Colored chips in source dialog are explanatory examples only.
- **Settings:** profile, reminder preferences, report lead time, backup JSON (including images), validated merge restore and CSV escaping spreadsheet formulas. Restore preserves existing confirmed actuals, existing crew/duty IDs and local reminder settings. Flight/duty removal uses a recoverable Trash in Settings.
- **PWA:** install manifest/icons, network-first shell cache with offline fallback. Weather is never cached by the service worker. Local data remains available offline; initial OCR model download needs internet.

## Ôn thi ATPL và học offline

Trong Pilot Logbook chọn **Ôn thi**. Có 11 bộ đề gốc, tổng **6.126 câu**, và **300 câu Mass & Balance tham khảo** ở bộ MBR riêng. Câu hỏi, lựa chọn, UID, đáp án gốc và bộ máy chấm thi được giữ nguyên từ bản ATPL đã bàn giao. Lời giải, cảnh báo xung đột/thiếu căn cứ và ảnh trích nguồn được chuyển nguyên trạng; tích hợp này không tạo thêm kết luận kiểm định.

Trên iPad mở app bằng Safari khi có mạng, chọn **Tải offline** cho từng môn và chờ **✓ Sẵn sàng offline**. Có thể thêm app vào Màn hình chính qua menu Chia sẻ. Sau khi tải đủ, câu hỏi, lời giải và ảnh nguồn của môn đó dùng được khi mất mạng. Chọn câu, tiếp tục học, bookmark, thi thử, ngày/đêm và xuất/nhập tiến độ vẫn hoạt động. Bộ MBR tham khảo có tiến độ và đáp án riêng; luyện thi theo đáp án gốc dùng MB.

Mỗi môn hiển thị dung lượng trước khi tải. Có thể dừng rồi tiếp tục; phần đã tải được kiểm tra và dùng lại. App kiểm tra byte và SHA-256 của từng tài nguyên, chỉ đánh dấu sẵn sàng sau khi lưu đủ. Thiếu ảnh, mất mạng hoặc hết dung lượng sẽ giữ trạng thái chưa hoàn tất. Cập nhật service worker giữ cache đề và dữ liệu logbook. Không xóa dữ liệu website nếu muốn giữ đề offline và tiến độ; xuất bản sao lưu riêng cho logbook và ATPL trước khi đổi thiết bị. Dữ liệu không tự đồng bộ giữa Mac/iPad. Các liên kết website ngoài, thời tiết và lần tải đầu cần mạng.

Nguồn đóng gói: SHA-256 `28fbacae42e5b05023c89b077d977e62184a2e916da0dc7d14bd521acd89239f`. `scripts/package-atpl.py` tạo HTML từng môn, catalog và manifest từ app nguồn; `data/atpl-media/` chứa ảnh base64 chia gói, được `lib/atpl-media.js` phục vụ theo URL hash. Ảnh được dùng chung giữa các môn, không lưu toàn bộ thư viện ảnh vào RAM máy chủ.

Kiểm thử: `node --test` (20/20) và `node scripts/verify-atpl-browser.cjs`. Chromium kiểm tra với offline flag; WebKit kiểm tra khi toàn bộ kết nối tới máy chủ bị từ chối do [lỗi mô phỏng offline của Playwright WebKit #42775](https://github.com/microsoft/playwright/issues/42775). Cả hai mở/chấm đủ 6.426 câu, đọc ảnh nguồn offline, khôi phục backup và giữ nguyên IndexedDB logbook. Chưa kiểm tra trực tiếp trên iPad vật lý. Báo cáo máy chạy được ghi trong `test-results/atpl/Browser_QA.json`.

## Preview limits

Browser-local workspace: no account login, cross-device sync, server storage, payments or real ads. Notifications/reminder checks run **while app is open**; no closed-app push. Tomorrow and evening preferences are UTC. Night time is manual; no unverified night calculator. No FTL compliance claim; a validated ruleset with version/effective date/source is required. Missing roster entries are retained for review, not treated as cancellations. Same flight number operated twice on one UTC date requires a future occurrence identifier and manual review.

## Architecture and extension

`public/lib/domain.js`: UTC, validation, merge, totals, backups and reminders. `parsers.js`: roster and aircraft-family registry. `rules.js`: pure versioned engine. `storage.js`: atomic IndexedDB transactions. `importers.js`: PDF/OCR adapters. `app.js`: browser UI. `lib/weather.js`: provider/cache adapter. `server.js`: static assets, health and weather API. To add aircraft support, register a parser and fixtures first. Add no airline rule without reviewed source provenance.

Specs/plans and verification notes live under `docs/`. No uploaded company PDFs or sensitive credentials are included in this repository.
