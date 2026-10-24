# AviLog — Flight Detail UI v12

Ngày đóng gói: 23/10/2026.
Nền: `AviLog_Smart_Scan_V2_FULL_2026-10-22.zip`.
Phạm vi: chỉ giao diện Thêm chuyến / Chi tiết chuyến / Kiểm tra Actual từ ảnh.
**Đã sửa mã nguồn; chưa triển khai Railway, chưa thay dữ liệu tài khoản thật.**

## Nội dung

- Header AviLog có Quay lại và một nút Lưu luôn ở đầu màn hình.
- Ba tab Log / Airports / Tools; chuyển tab giữ nguyên các ô và ảnh đang chọn.
- Log: Flight number, ngày bay, registration, aircraft, Crew thu gọn, DEP/DEST,
  Actual dạng lưới OUT–ON / OFF–IN, Scheduled thu gọn, người thực hiện takeoff/landing,
  PF/PM, landing mode, PIC/Night phút, Remarks và Flight Times.
- Airports: hiển thị hành trình hiện có, đối chiếu mã ICAO theo bảng có sẵn và chỉnh
  hành trình Scheduled riêng. Không lấy dữ liệu sân bay mới từ dịch vụ ngoài.
- Tools: source, confidence, ảnh gốc, xác nhận Actual và cho phép sửa Actual đã xác nhận.
- Sáng/tối dùng bảng màu navy/trắng của AviLog; mobile toàn màn hình, iPad/desktop dùng
  hộp chỉnh sửa. Kiểm tra bố cục 320 / 390 / 430 / 820 / 1440 px.
- Giữ từng ngày UTC ở cả sáu mốc giờ; nhập HHMM hoặc HH:MM theo bộ xử lý cũ.
- Lỗi ở tab ẩn sẽ đưa người dùng về trường sai đầu tiên. Có điều khiển tab bằng bàn phím.
- Chặn sự kiện đóng cửa sổ cũ đến muộn làm mất điều khiển của cửa sổ mới.

## Không thay đổi

`saveFlight()` giữ nguyên từng byte so với nền Smart Scan V2. Không thay schema,
Firestore/Storage rules, cơ chế sync/backup, dependency, package.version hoặc runtime
đã yêu cầu. Mã Smart Scan V2, bộ phân tích A320/A321/E190, tài khoản và toàn bộ dữ liệu
ATPL/ảnh nguồn được giữ nguyên. Cache shell mới: `avilog-shell-v12-flight-editor`.

Các mục trong ảnh ý tưởng nhưng chưa có field riêng — IFR/VFR minutes, actual instrument,
multi-pilot, takeoff/landing ngày–đêm, approach, runway, SID/STAR, threats, distance,
fuel, passengers — **chưa được thêm vào dữ liệu**. Không có nút đồng bộ myAVES/FlightAware
hoặc thông báo đồng bộ giả. Có thể dùng Remarks cho ghi chú tự do.

FINAL ở giao diện sử dụng cờ `confirmed` đang có, không phải hệ thống chứng nhận mới.
Scan không tự lưu hoặc tự xác nhận. Nút đính kèm ảnh trong Tools chỉ thêm minh chứng,
không tự chạy OCR; đọc ảnh vẫn đi qua **Logbook → Nhập từ ảnh**.

## Áp dụng

**FULL:** bộ nguồn hoàn chỉnh đã có Smart Scan V2 + UI v12.

**PATCH:** bản vá cộng dồn so với `AviLog_Full_Source_2026-10-22.zip`, bao gồm các file
Smart Scan V2 liên quan, không chỉ phần UI. Dùng cho đúng bộ nguồn gốc 22/10 hoặc bộ
Smart Scan V2 đã gửi trong cuộc trò chuyện. Nếu repository có thay đổi riêng mới hơn,
đối chiếu `FLIGHT_UI_V12_PATCH_MANIFEST.json` và merge thay vì chép đè mù quáng.

1. Xuất backup Logbook đầy đủ ảnh và backup ATPL từ app trước khi phát hành.
2. Giải nén; dùng nội dung bên trong thư mục `AviLog` làm gốc dự án. Không tạo thêm
   tầng thư mục lồng khi cập nhật repository.
3. Giữ nguyên `.env`, Variables Railway, hostname, Firebase project và bucket đang dùng.
   Không cần tạo project mới hoặc triển khai lại Firebase rules cho riêng thay đổi UI.
4. Kiểm tra bằng Node **>=24.12.0** theo `package.json`, rồi commit/push lên nhánh
   Railway đang theo dõi hoặc triển khai theo quy trình hiện có. Bản bàn giao này chưa push.
5. Sau khi bản mới triển khai xong, mở online, đóng các tab/PWA cũ và mở lại để nhận
   shell v12. **Không xóa dữ liệu website/cache bằng cách xóa toàn bộ site data** khi
   vẫn còn tiến độ, logbook hoặc ảnh chưa gửi.
6. Vào Logbook, mở một chuyến hoặc Thêm chuyến bay để kiểm tra UI mới.

## Kiểm thử và giới hạn thực tế

- `node --check`: mã JS đã thay đổi và các script CJS được cập nhật không có lỗi cú pháp.
- 5 kiểm thử mới trong `tests/flight-editor.test.js` đạt.
- 53 kiểm tra tương tác/bố cục Chromium component đạt, dùng chính renderer CSS/JS và
  các hàm `editFlight()`/`saveFlight()` từ app; adapter lưu dữ liệu chỉ ở RAM của test.
  Có kiểm tra sửa ghi chú giữ timestamp có giây/millisecond, sửa Actual cần cho phép,
  chuyến qua ngày, lưu crew, ảnh thêm/xóa, tab ẩn có lỗi, bàn phím và cảnh báo scan.
- `npm test` toàn bộ: **180 đạt, 5 không đạt**, so với trước sửa **175 đạt, 5 không đạt**.
  Cả năm thất bại có trước thay đổi UI: hai lỗi do thiếu package Firebase trong môi trường
  chạy và ba lỗi cần commit Git cũ mà ZIP không chứa. Không bỏ/skip hoặc sửa các kiểm thử
  đó để đổi kết quả thành xanh. Chi tiết nằm trong `docs/FLIGHT-EDITOR-V12-QA.json`.
- Môi trường kiểm tra đang có Node 22.16.0, thấp hơn yêu cầu Node >=24.12 của dự án.
  Không hạ yêu cầu trong mã nguồn; cần chạy lại bộ test trong môi trường triển khai phù hợp.
- Chromium bị chính sách môi trường chặn điều hướng mọi URL, gồm localhost. Vì vậy
  ảnh chụp và 53 kiểm tra là **DOM component cô lập**, không phải chạy toàn app qua server.
  Không sửa/chặn bỏ chính sách này. Script `scripts/verify-flight-editor.py` ghi rõ phạm vi.
- Chưa chạy thử iPhone/iPad vật lý, WebKit, OAuth Google thật, Firebase emulator,
  service worker offline trong trình duyệt hoặc OCR ảnh thật cho bản UI này.
  Những phần trên không được tuyên bố đã kiểm chứng.
- So sánh byte/SHA-256: 115 file trong ATPL, ảnh nguồn, tài khoản, workspace và Firebase
  giống hệt bộ Smart Scan V2. Đây không phải kết luận về dữ liệu trên cloud.

## Chạy lại

```sh
npm ci --ignore-scripts
npm test
npx playwright install chromium webkit
node scripts/verify-utc-input.cjs
node scripts/verify-enhancements.cjs
node scripts/verify-e190-note.cjs
node scripts/verify-workspace-ui.cjs
```

Các script trình duyệt CJS liên quan đã đổi điều hướng sang tab Tools và khối Crew.
Chúng cần được chạy lại ở môi trường cho phép mở server nội bộ; lần bàn giao này chỉ
kiểm tra cú pháp các script đó. Script component Python bổ sung cần Playwright Python
và Chromium sẵn có, có thể đặt `CHROMIUM_PATH`:

```sh
python scripts/verify-flight-editor.py
```

Không cần Python để chạy ứng dụng AviLog.
