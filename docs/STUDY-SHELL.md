# Ôn thi trong cùng giao diện Avilog

Yêu cầu tiếp theo của Navy V2: khi mở Ôn thi không có cảm giác chuyển sang ứng dụng khác.

## Thay đổi

- Cùng danh sách điều hướng cho app chính, thư viện môn học và từng ngân hàng, từ `public/ui/navigation.js`. Desktop giữ sidebar và mục Ôn thi đang chọn. Mobile giữ cùng pill/More/Add ở thư viện và trang đầu môn học.
- Giao diện môn học dùng tên Avilog · Ôn thi, cùng theme, card, font và menu ba gạch Tài khoản & Đồng bộ. Môn học và quản lý môn vẫn có lối vào riêng rõ ràng; không bỏ các chức năng tải offline/backup hiện có.
- Khi đang trả lời trên mobile, thanh thao tác câu hỏi được ưu tiên thay thanh điều hướng toàn app để không chồng nút. Header Avilog và nút Môn học vẫn hiện; desktop tiếp tục có sidebar.
- Bớt phần ghi chú lặp lại trên từng card môn; thông tin về key gốc vẫn có trong giới thiệu và menu Quản lý của môn. Bản MB hiệu chỉnh vẫn riêng biệt và có nhãn tham khảo.
- Trở lại đúng mục Logbook/Lịch bay/Weather/Crew/Statistics/Settings bằng URL công khai được whitelist. Reload vẫn giữ màn hình đang chọn. Add từ Ôn thi mở form chuyến bay hiện có, không tự lưu.
- Worker cache chỉ alias root HTML cho các query điều hướng công khai hợp lệ; query/API/OAuth/private data và request có Authorization vẫn bypass cache. Không cache dữ liệu người dùng vào shell.
- Khi tài khoản đổi tiếp trong lúc mở workspace, UI thử mở theo generation mới nhất; vẫn bỏ phiên cũ và giữ nguyên guard/lưu trữ.
- Giữ cảnh báo lỗi/reauth/reset epoch ngoài menu câu hỏi. Menu tài khoản có thể đóng bằng nút ba gạch, Escape hoặc bấm bên ngoài. Menu mới có trạng thái loading trước khi SDK sẵn sàng.

## An toàn

Không sửa bytes HTML ngân hàng, đề, key gốc, engine, identities, model/store/controller sync, auth bootstrap, schema/rules, workspace/logbook calculations hoặc source images. Không tạo workspace writer trong Ôn thi chỉ để dựng sidebar. Adapter di chuyển DOM đang có, dùng lại chính bankStore của môn. Không reset tiến độ hoặc đổi key localStorage/IndexedDB.

Đăng nhập và sync vẫn dùng Firebase thật khi app được cấu hình; kiểm thử ở đây dùng guest/emulator. Không deploy production; tiếp tục trong draft PR #5.

## Kiểm chứng

- Build Firebase đạt, không đổi SDK bytes.
- Unit/API: 299 đạt; có test mới cho navigation dùng chung và cache root-query chỉ whitelist, giữ bypass dữ liệu riêng tư.
- Shared UI 250 checks đạt trên Chromium/WebKit, 320/390/820/1440, sáng/tối và offline.
- `verify-study-shell.cjs`: 8 cấu hình browser×viewport + 2 luồng offline đạt. Có kiểm tra chọn key đúng của câu đang hiển thị, trả lời rồi qua lại Library/Logbook/reload giữ nguyên tiến độ, theme round trip và không overflow.
- All-bank browser regression: 12 ngân hàng trên hai browser, source-key scoring, source images, tải/offline và logbook preservation đạt.
- Auth/Firestore emulator đạt trên Chromium và WebKit: cùng/khác UID, offline + source image, lost acknowledgement + local tail, reset epoch + backup/recovery, khóa tab, readonly khi thiếu Web Locks, logout từ môn cập nhật app chính, token bị thu hồi và mobile redirect. Không có lỗi ứng dụng; các diagnostics WebKit chỉ được phân loại khi có bằng chứng request bị hủy/ngắt ở emulator.
- Weather + ATPL SDK emulator đạt trên Chromium/WebKit: watchlist và nhóm đồng bộ/offline/UID riêng, trả lời/bookmark tự đồng bộ và phục hồi cloud trong thư viện.
- Các helper browser chờ UI sẵn sàng, lần reload thực của đăng nhập và đóng menu bằng summary trước khi học; không bỏ assertion bảo toàn dữ liệu. Test bổ sung từ Add trong Ôn thi mở form chưa lưu và xác nhận dữ liệu không đổi.

Ảnh và kết quả: thư mục `docs/study-shell/` (dữ liệu guest tổng hợp). Không phải OAuth thật hoặc thiết bị iPhone vật lý. Cảnh báo dev-tool audit của PR trước vẫn là release gate, không bị bỏ qua trong thay đổi này.

## Xem thử

Mở `http://127.0.0.1:4173/atpl/`. Nếu đang mở bản cũ, tải lại online để worker mới kích hoạt rồi tải lại thêm một lần; không xóa dữ liệu website. Bản preview này tắt đăng nhập production và dùng kho khách.

Rollback giao diện follow-up: trở về commit `85dd065` trên nhánh review. Không reset database/UID hoặc xóa browser storage. Các bank/store formats không thay đổi.
