# AviLog — bộ mã nguồn đầy đủ

Đây là dự án có thể chỉnh sửa bằng VS Code hoặc trình soạn thảo bất kỳ, chạy trên máy riêng và tự đưa lên GitHub. Không cần Codex. Gói có mã web, máy chủ, ngân hàng đề, lời giải, ảnh nguồn, cấu hình Docker/Railway và luật Firebase.

## 1. Chạy trên Mac hoặc Windows

1. Giải nén ZIP, mở thư mục `AviLog` bằng trình soạn thảo.
2. Cài Node.js phiên bản **24.12 trở lên**, kèm npm. Mở Terminal tại thư mục có `package.json`.
3. Chạy lần lượt:

```sh
npm ci --ignore-scripts
npm start
```

4. Mở **http://localhost:3000**. Giữ cửa sổ Terminal đang chạy; `Ctrl+C` để dừng.

Lần cài thư viện đầu cần internet. Không mở trực tiếp `public/index.html` bằng cách bấm đúp: AviLog cần máy chủ để phục vụ ảnh nguồn, API thời tiết và các chức năng PWA. Đổi cổng nếu 3000 đang được dùng; ví dụ `PORT=3001 npm start` trên Mac.

Gói nguồn không có `node_modules`; npm cài đúng phiên bản theo `package-lock.json`. Bản Firebase SDK dùng ở trình duyệt đã được đóng gói sẵn, không cần build lại chỉ để chạy. Khi sửa mã nguồn SDK đồng bộ thì chạy `npm run build:atpl-account`.

## 2. Chỉnh sửa chỗ nào

| Phần cần sửa | Vị trí |
| --- | --- |
| Giao diện chính, Lịch bay, Logbook, Crew | `public/app.js` |
| Navy/trắng, ngày/đêm, bố cục | `public/style.css`, `public/lib/appearance.js` |
| Nhập giờ UTC 24h | `public/lib/utc-input.js` |
| Theo dõi METAR/TAF, nhóm sân bay | `public/workspace/weather-watch-ui.js`, `weather-watch.js`, `weather-groups.js` |
| Đăng nhập, dữ liệu tài khoản, đồng bộ | `public/account/`, `public/workspace/` |
| Trang danh sách môn và ngân hàng đề | `public/atpl/` |
| Ảnh trích nguồn của ngân hàng đề | `data/atpl-media/` và `lib/atpl-media.js` |
| Máy chủ, API, nguồn thời tiết | `server.js`, `lib/weather.js`, `lib/met-office.js` |
| Triển khai | `Dockerfile`, `railway.json`, `firebase/`, `firebase.json` |

Giữ nguyên đáp án gốc khi sửa phần ôn thi. **Giữ đủ `data/atpl-media/`**; ngân hàng HTML cần các gói này để mở ảnh. Không sửa file theo URL hash rồi đổi tên tùy ý: manifest offline kiểm tra byte/SHA-256. Khi sửa shell web, đổi phiên bản cache trong `public/sw.js` và cập nhật kiểm thử liên quan để máy đang dùng nhận bản mới.

## 3. Đăng nhập, đồng bộ và nguồn thời tiết

Gói không chứa mật khẩu thời tiết, cookie, khóa tài khoản dịch vụ hoặc file `.env` thật. `.env.example` là mẫu trống; chạy mặc định bằng chế độ khách, nguồn thời tiết dự phòng NOAA. Đây không phải việc xóa dữ liệu hay tắt cấu hình đang có trên Railway.

Để chạy với cấu hình riêng trên máy:

```sh
cp .env.example .env
```

Điền các biến cần dùng trong `.env`, rồi chạy:

```sh
node --env-file=.env server.js
```

Trên Windows có thể sao chép và đổi tên file bằng File Explorer. `npm start` không tự đọc `.env`; dùng lệnh `node --env-file` ở trên khi cần file này.

Các biến Google/Firebase là cấu hình của chính dự án Firebase hiện có. Nguồn thời tiết ưu tiên dùng `MET_OFFICE_USERNAME` và `MET_OFFICE_PASSWORD` ở phía máy chủ. Tuyệt đối không đưa mật khẩu vào `public/`. Trên Railway điền biến trong **Variables**, không đưa `.env` lên GitHub. Đổi hostname cần cấu hình lại origin/Authorized domains/OAuth/CORS tương ứng; xem `README.md`. Không cần tạo Firebase project hoặc bucket mới để dùng lại AviLog hiện tại.

## 4. Đưa lên GitHub và Railway

Với **repository mới, trống**, dùng GitHub Desktop hoặc Terminal tại thư mục `AviLog`:

```sh
git init
git add .
git commit -m "Import AviLog source"
git branch -M main
git remote add origin https://github.com/TEN_TAI_KHOAN/TEN_REPO.git
git push -u origin main
```

Thay URL bằng repository của bạn. Nếu Git chưa có tên/email, cấu hình danh tính Git theo hướng dẫn trên màn hình trước khi commit. Cần xác thực GitHub của chính bạn.

Để cập nhật **repo Pilot-logbook đang có**, clone repo đó trước, sao chép nội dung thư mục `AviLog` vào bản clone (bỏ qua `.git`, `.env`, `node_modules`), xem diff, commit và push bình thường. Không ép ghi đè lịch sử bằng force push. Đưa nội dung dự án lên repo, không chỉ tải file ZIP lên repo.

`.gitignore` đã bỏ qua `.env`, `node_modules`, kết quả kiểm thử và công cụ cục bộ. Giữ `package-lock.json`, `public/`, `data/`, `lib/` khi commit. File lớn nhất hiện dưới 9 MB, không cần Git LFS cho bộ nguồn này.

Railway dùng Dockerfile có sẵn, healthcheck `/api/health`, tự cấp `PORT`. Với dịch vụ AviLog hiện có, giữ nguyên project/service, domain và Variables; cập nhật nhánh nguồn đang kết nối. **GitHub Pages đơn thuần không chạy được backend thời tiết và proxy xác thực của dự án này.**

## 5. Offline và dữ liệu cá nhân

Học offline: mở app khi có mạng, vào Ôn thi và tải đủ từng môn. Trên thiết bị mới cũng tải ảnh minh chứng cần dùng offline. Cập nhật thời tiết và lần đăng nhập đầu cần mạng; khi mất mạng xem bản tin chữ đã lưu.

**ZIP mã nguồn không chứa chuyến bay, ảnh minh chứng cá nhân hay tiến độ học của bạn.** Chúng nằm trong trình duyệt/tài khoản Firebase. Trước khi đổi địa chỉ web hoặc xóa dữ liệu trình duyệt, xuất backup Logbook đầy đủ ảnh và backup Ôn thi từ app. Giữ đủ các phần backup. Dùng cùng Google để nhận phần đã đồng bộ trên thiết bị khác; phần còn trên máy cần xuất/nhập riêng.

## 6. Kiểm tra sau khi sửa

```sh
npm test
```

Kiểm thử trình duyệt cần cài browser một lần:

```sh
npx playwright install chromium webkit
node scripts/verify-top-management.cjs
node scripts/verify-utc-input.cjs
npm run test:weather-ui
```

Trên Linux có thể cần thêm thư viện hệ thống theo hướng dẫn của Playwright. Kiểm thử Firebase rules/SDK dùng emulator và yêu cầu bổ sung Java/tooling; xem `README.md` và `docs/workspace-verification.md`. Kiểm thử desktop giả lập không thay thế thử trực tiếp trên iPad hoặc đăng nhập Google thật.

## 7. Nội dung bản bàn giao

Bao gồm nhập UTC 24h với ngày chỉnh riêng; menu Quản lý trên thanh trên cùng cho Lịch bay, Logbook, Crew, Thống kê và Thời tiết; ngày/đêm; E190; gợi ý/tạo crew khi lưu chuyến; ngân hàng đề và đáp án gốc được giữ nguyên. Trạng thái kiểm thử và giới hạn nằm trong `docs/TOP-MANAGEMENT-QA.json`.

Đóng gói ngày 22/10/2026. Việc có ZIP không có nghĩa phiên bản đã được triển khai lên website; kiểm tra trạng thái Railway riêng khi xuất bản.
