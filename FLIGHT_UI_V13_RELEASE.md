# AviLog — Flight Detail V13 · Compact spacing

Ngày chỉnh sửa: 23/10/2026. Nền: `AviLog_Flight_UI_V12_FULL_2026-10-23.zip`.
**Mới sửa mã nguồn và tạo preview/test; chưa deploy Railway, Firebase hay cập nhật dữ liệu người dùng.**

## Mục tiêu

Giữ nguyên layout Flight Detail (Log / Airports / Tools) đã chọn, nhưng thu bớt phần trắng
ở header, khoảng cách card, ô ngày/giờ và bảng tổng giờ — **khít vừa**, không làm mất
vùng chạm. Không thay đổi chữ, định nghĩa OUT/OFF/ON/IN, Scheduled/Actual, hoặc quy
trình xác nhận dữ liệu từ Smart Scan V2.

## Các thay đổi

- Header iPhone: 70 → 60 px, tab Log/Airports/Tools: 55 → 49 px (đo trong Chromium 390px).
- Card Flight Record iPhone: khoảng 217 → 188 px; card hành trình + Actual: khoảng 400 → 338 px.
- Khoảng cách giữa các card: 12 → 8 px.
- Vẫn giữ nút đóng/lưu, ba tab với vùng chạm >=44 px; ô giờ chính >=40 px.
- Màn hình 320, 390, 430, 820px đều có bố cục kiểm thử không tràn ngang; chế độ sáng/tối.
- Phần ảnh preview được cắt gọn sát màn hình, không chừa khung đen/trắng trang trí xung quanh.
- Đổi tên cache shell thành `avilog-shell-v13-compact` để PWA lấy CSS mới khi được triển khai.

Đây là **sửa CSS có phạm vi** trong `public/style.css`; `public/sw.js` đổi cache version;
`tests/flight-editor.test.js` và `tests/workspace-service-worker.test.js` đổi kỳ vọng cache;
thêm kiểm thử density `scripts/verify-flight-editor-compact.py`. `public/app.js`,
`public/lib/flight-editor.js`, schema, Firebase rules, ATPL, ảnh nguồn và dependency giữ nguyên.

## Cập nhật & an toàn dữ liệu

- **FULL**: toàn bộ bộ nguồn AviLog đã có Smart Scan V2 và Flight UI V12, được cập nhật mật độ V13.
- **PATCH V12 → V13**: chỉ các file thay đổi; áp dụng cho mã nguồn **V12** đã bàn giao. Nếu code trong GitHub đã thay đổi thêm, xem diff và merge thủ công, không chép đè toàn bộ.
- Trước khi đưa lên server: backup Logbook đầy đủ ảnh + tiến độ ATPL, đồng thời xác minh Git diff và tests trên Node >=24.12.
- Giữ nguyên Railway service, Variables, hostname, Google/Firebase và bucket; không deploy Firebase rules vì giao diện không cần đổi rules.
- Sau khi phát hành, đóng tab/PWA cũ và mở lại online để lấy shell mới; **không xóa dữ liệu website**, vì có thể chứa logbook và tiến độ offline chưa đồng bộ.

## Kiểm thử tại môi trường tạo bản này

- Test mới được chạy RED trên V12 (fail vì header 70px) và GREEN trên V13: **5/5 kích thước/chế độ**.
- Test Chromium component gốc `python scripts/verify-flight-editor.py`: **53 kiểm tra đạt**, không có lỗi trang.
- Test `node --test tests/flight-editor.test.js tests/workspace-service-worker.test.js`: **12/12 đạt**.
- Bộ `npm test` đầy đủ: **180 đạt / 5 không đạt**; 5 lỗi giống danh sách v12 (thiếu SDK Firebase và Git history trong bản ZIP). Không ghi chúng là đã sửa.
- Runtime ở đây Node 22.16, thấp hơn `engines.node >=24.12.0`; chưa kiểm tra iPhone/iPad thật, WebKit, OAuth/Firebase thực, SW offline end-to-end, OCR ảnh thực hay Railway live.

Chỉ preview DOM cách ly bằng Chromium (không phải chạy app đã đăng nhập với dữ liệu thật).
Tham khảo số đo và kiểm thử trong `docs/FLIGHT-EDITOR-V13-QA.json`.
