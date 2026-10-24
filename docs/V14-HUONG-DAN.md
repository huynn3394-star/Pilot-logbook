# AviLog V14 — Quick Entry, Scan Review & FINAL

**Ngày đóng gói:** 24/10/2026.  
**Nền:** `AviLog_Flight_UI_V13_COMPACT_FULL_2026-10-23.zip`.  
**Trạng thái:** mã nguồn đã sửa và kiểm tra trong môi trường cục bộ; chưa push GitHub, chưa triển khai Railway, chưa thay đổi Firebase thật.

## 1. Bản này có gì

Giữ màn Flight Detail Compact V13, ba tab Log / Airports / Tools, ngày/đêm và Smart Scan V2.

**Quick Entry:** nhập ngày UTC và số hiệu, rời ô nhập. Nếu có đúng một chuyến cùng ngày, app mở bản đó để tiếp tục ghi giờ, không tạo bản mới. Nếu đã nhập thêm thông tin khác, app yêu cầu bạn chủ động chọn mở chuyến và xác nhận bỏ biểu mẫu chưa lưu. Nhiều kết quả thì phải chọn. Hỗ trợ so khớp `VN0506`, `VN506`, `HVN506`; không đổi khóa bản ghi cloud đang tồn tại. Lịch sử ngày trước chỉ gợi ý DEP/DEST sau khi bạn chọn, không sao chép registration, Actual hay crew. Không gọi dịch vụ chuyến bay bên ngoài.

**Scan Review:** sau Nhập từ ảnh → Xem trước Actual, có bảng dữ liệu đang lưu / dữ liệu đọc từ ảnh. Chỗ khác nhau hoặc chưa đọc được có nhãn riêng. Giá trị ảnh còn thiếu có thể giữ từ bản cũ, nhưng không được coi là đã đọc từ ảnh. Hãy đối chiếu và chọn xác nhận kiểm tra trước khi chốt FINAL. Không lưu tự động. Bộ OCR vẫn là Smart Scan V2, không phải một engine OCR mới; chưa đo lại độ chính xác ảnh thật trong lần phát hành này.

**FINAL và lịch sử:** đổi ngày/số hiệu, hành trình, Actual, phân bổ giờ, tổ bay, vai trò, nguồn hoặc ảnh của FINAL cần tích cho phép sửa và ghi lý do. Lưu lần xác nhận đầu, sửa sau xác nhận, mở lại nháp và chỉnh ghi chú dưới dạng trước/sau. Ghi chú đơn thuần không thay Actual nhưng vẫn vào lịch sử. Hai thiết bị sửa cùng bản đã có lịch sử tạo xung đột để xem, không chọn bên thắng bằng đồng hồ. Chọn bản cục bộ sẽ ghi một lượt mới trên lịch sử máy chủ; nhánh cục bộ gốc được giữ trong phần phục hồi.

**Giờ bổ sung:** trong Log → Phân bổ giờ & số lần của tôi, nhập SIC, PICUS, IFR, VFR, Actual Instrument, Cross-country bằng phút; Takeoff/Landing ngày/đêm bằng số lần. Trống = chưa ghi; `0` = đã nhập bằng 0. Không suy PIC/SIC từ PF/PM, Instrument từ IFR, không tính đêm tự động. Bản cũ còn giữ cách tính SIC = Block − PIC và được ghi nhãn số liệu cũ. Bản mới V14 để SIC chưa biết cho đến khi nhập. Kiểm tra số nguyên, khoảng thời gian và tổng IFR+VFR; các nhóm thời gian có thể chồng lấp nên không cộng tất cả thành một tổng. Đây không phải kiểm định cách ghi giờ theo giấy phép của nhà chức trách.

**Lưu trữ:** dữ liệu bổ sung đi cùng bản ghi trong JSON backup, khôi phục, CSV và luồng đồng bộ đã cập nhật. Không chỉ thêm ô nhập lên giao diện. File backup cũ không được tự thay một bản đang có lịch sử, kể cả bản đó đã mở lại thành nháp.

## 2. Chọn FULL hay PATCH

- **FULL:** dùng toàn bộ nội dung bên trong thư mục `AviLog` làm gốc dự án. Có cả dữ liệu ATPL, ảnh nguồn, backend và các nâng cấp cũ. Dùng bản này khi GitHub của bạn chưa có V13.
- **PATCH:** chỉ áp dụng vào đúng V13 Compact đã gửi. Xem `V14_PATCH_MANIFEST.json` để so hash trước/sau. Không chép PATCH này lên bản nguồn tháng 10 cũ hoặc nhánh đang dùng shell v9; dùng FULL hoặc merge có kiểm tra.

Không upload `.env`, cookie, mật khẩu hoặc service-account key. Giữ nguyên Variables, hostname Railway, Firebase project và bucket hiện dùng. Không cần tạo hệ thống lưu trữ mới.

## 3. Điểm bắt buộc khi dùng tài khoản Google

V14 thêm dữ liệu `logbook` và `auditTrail`, nên **phải cập nhật Firestore rules và build lại Firebase SDK** trước khi bật các trường này cho tài khoản.

Khóa mới, mặc định tắt:

```text
AVILOG_LOGBOOK_V14_ENABLED=false
```

**Khách:** có V14 ngay, lưu tại trình duyệt. **Tài khoản Google khi khóa tắt:** hiển thị “Chế độ tương thích V13”; chưa bật trường giờ/lịch sử mới. Nhập backup/khách chứa dữ liệu V14 vào tài khoản sẽ bị chặn rõ ràng, không cắt bỏ metadata để nhập. Bản ghi đã có metadata V14 chỉ được xem khi khóa bị tắt.

### Thứ tự cập nhật

1. Xuất backup Logbook đầy đủ mọi phần ảnh và backup ATPL riêng. Kiểm tra trạng thái dữ liệu/ảnh đang chờ đồng bộ trên từng thiết bị.
2. Đưa FULL vào repository/nhánh thử nghiệm, giữ thư mục gốc đúng cấu trúc. Giữ khóa V14 tắt trong giai đoạn kiểm tra.
3. **Dockerfile V14 tự cài các dependency đã khóa và chạy `npm run build:atpl-account`** trong build stage, sau đó chỉ đưa runtime/dependency production vào image cuối.
4. Chạy lại kiểm thử trên Node **>=24.12.0**, đặc biệt Firebase emulator và luồng đăng nhập/đồng bộ iPhone–iPad thật trước khi dùng cho dữ liệu chính.
5. Triển khai file `firebase/firestore.rules` được gửi kèm vào **đúng Firebase project hiện tại** bằng tài khoản quản trị của bạn. Ví dụ, thay `YOUR_EXISTING_PROJECT_ID` bằng ID dự án đang dùng:

```sh
npx firebase deploy --only firestore:rules --project YOUR_EXISTING_PROJECT_ID
```

6. Khi build và kiểm tra rules đạt, đặt `AVILOG_LOGBOOK_V14_ENABLED=true` trong Variables của dịch vụ Railway hiện tại và phát hành bản cấu hình đó. Không bật khi chưa triển khai rules.
7. Mở online trên **tất cả thiết bị**, đóng tab/PWA cũ và mở lại để nhận shell mới. **Không xóa site data/IndexedDB.** Kiểm tra thử một chuyến, ảnh, sửa có lý do, đồng bộ sang máy khác, xuất/nhập backup rồi mới sử dụng rộng rãi.

Service worker dùng nền `avilog-shell-v14-fast-entry`; khi SDK được build sẽ thêm hậu tố `-sdk-<hash>` để bản SDK cũ không còn bị giữ trong cache của shell mới. Dữ liệu người dùng và cache ngân hàng đề không bị reset.

### Chạy trên máy riêng

```sh
npm ci --ignore-scripts
npm run build:atpl-account
npm test
npm run test:workspace-rules
npm start
```

Các biến `.env` phải được đọc bằng `node --env-file=.env server.js` như hướng dẫn cũ; `npm start` không tự đọc `.env`. Kiểm thử Firebase rules cần Java/emulator theo tài liệu dự án. Không đổi phiên bản dependency hoặc hạ yêu cầu Node để né lỗi môi trường.

**Giới hạn build ở lần bàn giao này:** môi trường hiện tại không cài tải xong dependency, nên Firebase SDK V14 và Docker image chưa được build tại đây. ZIP chứa nguồn build mới cùng bundle SDK sẵn có từ V13. Docker sẽ build lại khi triển khai; local cần chạy lệnh build ở trên. Server có kiểm tra contract và hash: nếu cố bật V14 với SDK cũ/không khớp nguồn, server dừng với thông báo build lại thay vì âm thầm dùng validator cũ. Chưa được hiểu là Docker build hoặc cloud đồng bộ đã kiểm chứng.

## 4. Kiểm thử thực sự đã chạy

- `npm test`: **229 ca — 224 đạt, 5 không đạt**. Nền V13: 180 đạt/5 không đạt. Có **44 kiểm thử mới V14 đạt**, không thêm lỗi so với nền.
- **53 kiểm tra hồi quy giao diện + 36 kiểm tra tương tác V14 đạt** trong Chromium DOM component cô lập, dùng renderer/CSS cùng `editFlight`/`saveFlight` từ app. Persistence được thay bằng RAM trong harness. Kiểm tra tự điền, chọn kết quả, giữ ô đang nhập, FINAL/lý do, scan thiếu ON, giờ thủ công, compatibility gate và nhiều kích thước sáng/tối.
- Kiểm tra mô hình merge hai thiết bị, lưu qua session khách/tài khoản, backup/restore cùng **byte ảnh thực và SHA-256**, dữ liệu bổ sung, lịch sử, thay tài khoản và build/cache guard.
- So sánh SHA-256 với ZIP V13: **89 file ATPL/ảnh nguồn không đổi**; `a320-scan.js`, `scan-screen.js`, `parsers.js`, `importers.js`, package.json, package-lock.json và Storage rules không đổi. **Firestore rules có thay đổi có chủ đích.**
- Kiểm tra cú pháp các JavaScript đã sửa/thêm đạt.

Năm lỗi có trước: hai ca thiếu Firebase dependency (`atpl-auth-device`, workspace disabled transport) và ba ca dùng `git show` tới lịch sử commit không có trong ZIP (`weather-upgrade` hai ca và `workspace-source` một ca). Không xóa/skip các kiểm thử này. Báo cáo JSON ghi tên đầy đủ và log.

**Chưa kiểm chứng:** Node đúng phiên bản >=24.12 trong môi trường này (đang có Node22.16), Firebase emulator/rules thực thi, SDK build/Docker build, Google OAuth thật, đồng bộ cloud thật, WebKit, iPhone/iPad vật lý, service-worker offline end-to-end và OCR lại ảnh thật. Browser policy chặn điều hướng mọi URL gồm localhost; các ảnh preview là component thật với dữ liệu minh họa, không phải ảnh website đã triển khai. Không vượt/bỏ qua chính sách đó.

## 5. Lưu ý lịch sử / khôi phục

- Lịch sử bắt đầu từ lần xác nhận hoặc chỉnh sửa trên V14; không tự dựng lại các lần sửa cũ.
- Lịch sử dùng đồng hồ thiết bị và dấu SHA-256 ảnh, **không phải chữ ký điện tử/chứng thực bất biến**.
- Lịch sử giữ tối đa 100 lượt và 80.000 byte cho một chuyến; vượt giới hạn thì chặn lưu, không tự xóa lượt cũ.
- Lưu hash ảnh trong lịch sử. Backup đầy đủ ảnh giữ **ảnh hiện tại của bản ghi**; không cam kết giữ byte mọi ảnh đã từng thay. Để giữ tất cả minh chứng cũ, xuất backup trước khi thay ảnh.
- Tắt khóa V14 không xóa metadata, lịch sử, hàng đợi hay ảnh. Không quay về mã V13/rules cũ sau khi đã dùng dữ liệu V14; xuất backup và xử lý bằng phiên bản còn hiểu metadata.
- Không có kết nối myAVES/FlightAware, tính phí/thu tiền mới hoặc thay đổi ngân hàng ATPL trong bản này.
