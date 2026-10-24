# AviLog Smart Scan V2 — 22/10/2026

## Nâng cấp phạm vi A320/A321

- Tự phát hiện cụm màn hình tối với ký tự xanh trên ảnh MCDU, trả về vùng crop theo phần trăm; nếu không xác định được, OCR ảnh gốc (không đoán vùng).
- Cắt và tăng tương phản bằng Canvas trên thiết bị, không thay đổi JPG/PNG/WebP gốc hoặc đường lưu ảnh minh chứng.
- OCR vùng cắt trước; chỉ thử toàn ảnh khi số chuyến, route, OOOI chưa đủ hoặc kiểm tra giờ báo lỗi.
- Có canvas kéo chọn vùng bằng chuột/cảm ứng trong **Nhập từ ảnh → Smart Scan V2**, nút đọc lại vùng chọn và nút đọc toàn ảnh.
- A320 parser không coi `DATE/DEPT/DEST` là ICAO. Đọc `VVNB/ZGGG → HAN/CAN`, sửa lỗi OCR ký tự ở flight number/time với cảnh báo; không tự suy diễn thời gian sai (`26:00` giữ trạng thái cần sửa).
- Hiển thị đối chiếu hai thời lượng `FLIGHT` và `BLOCK`, đánh dấu nếu chênh lệch, không tự sửa dữ liệu.
- Đủ 4 mốc vẫn là **Actual nháp** cho đến khi phi công xem và xác nhận trong form.
- Giữ nguyên E190, ATPL ngân hàng gốc, Firebase, dữ liệu, đồng bộ, Docker/Railway.

## Kiểm thử

`node --test tests/a320-smart-scan.test.js tests/a320-screen.test.js tests/domain.test.js tests/e190.test.js`

`npm test` nếu môi trường đủ Node >=24.12, thư viện và lịch sử Git để chạy các kiểm thử phụ thuộc `git show`. Một số test trong ZIP nguồn gốc cần lịch sử Git hoặc Firebase SDK; nếu thiếu sẽ báo FAIL môi trường, không phải do Smart Scan.

Ảnh VN0506 do người dùng gửi được dùng để kiểm tra thủ công. Lệnh OCR với vùng màn hình đã cắt cho ra `VN@506/-- VVNB/ZGGG`, đủ OUT 06:00, OFF 06:13, ON 07:35, IN 07:58. Các sai lệch như `@` phải xem lại ảnh trước khi lưu. Chưa xác minh trên iPhone/iPad vật lý hoặc dịch vụ Railway thật.

## Cài đặt

Tải bản FULL hoặc áp các file trong ZIP patch đúng đường dẫn. Mở online một lần và đóng/mở lại PWA để cập nhật shell `avilog-shell-v11-smart-scan-v2`. **Không xóa website data/IndexedDB, Firebase Storage, tiến độ ATPL hoặc bản lưu dữ liệu thật.** Sao lưu Logbook + ATPL trước khi triển khai. Bản vá này chưa được tự động deploy.
