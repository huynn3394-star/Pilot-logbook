# AviLog: tài khoản chung, đồng bộ toàn app và ảnh, dùng offline

Ngày: 2026-10-20 (Asia/Saigon).

Trạng thái: đặc tả đã viết để người dùng duyệt; chưa triển khai thay đổi trong tài liệu này.

Mốc đối chiếu: `9f8e20b91a047477e04e9be080aed8f3136a08ab` của Pilot-logbook.

Địa chỉ giữ nguyên: `https://avilog-preview-preview.up.railway.app`.

## 1. Nội dung người dùng đã chọn

Người dùng muốn đăng nhập Google cá nhân hóa **toàn AviLog**, không chỉ Ôn thi: hồ sơ, lịch bay, duty, logbook, crew, thống kê, cài đặt và ảnh minh chứng. Cùng tài khoản trên điện thoại và iPad phải nhận cùng dữ liệu sau đồng bộ. Tài khoản khác phải có dữ liệu riêng. App vẫn dùng offline và giữ nguyên đáp án gốc.

Người dùng đã chọn đồng bộ cả ảnh và phương án Firebase Storage, chấp nhận có thể phát sinh phí. Ngày 20/10/2026, người dùng duyệt thiết kế trong chat và yêu cầu viết đặc tả chi tiết. Lần duyệt đó cho phép viết tài liệu này; tài liệu và kế hoạch triển khai vẫn cần được duyệt trước khi sửa sản phẩm. Việc viết tài liệu không nâng gói Firebase, gắn tài khoản thanh toán hoặc tạo bucket.

Tóm tắt hành vi để duyệt:

- Đăng nhập ở trang chính hoặc Ôn thi đều chọn cùng một tài khoản cho toàn app.
- Lưu dữ liệu trên thiết bị trước; khi có mạng và phiên Google hợp lệ mới gửi lên cloud.
- Logbook và ảnh có trạng thái đồng bộ riêng; lỗi ảnh không làm mất chuyến bay.
- Hai máy sửa cùng thông tin thì giữ các phiên bản để người dùng giải quyết, không âm thầm chọn theo đồng hồ máy.
- Dữ liệu cũ chỉ nhập vào tài khoản sau khi có bản phục hồi tại máy và người dùng xem trước, xác nhận.
- Không thay câu hỏi, lựa chọn, UID, đáp án, lời giải nguồn hoặc bộ máy chấm điểm. MB và MBR tiếp tục riêng.
- Giữ màu navy và đường link cũ. Chưa có xác nhận sao lưu để đổi tên miền.

## 2. Hiện trạng và lựa chọn kiến trúc

Ở mốc đối chiếu, trang chính đọc/ghi một khóa `state` trong object store `workspace`, IndexedDB `avilog-preview-v1`. Hồ sơ, flights, duties, people, settings, trash và ảnh data URL cùng nằm trong trạng thái đó. Trang chính chưa có tài khoản. Dữ liệu mẫu có `demo: true`.

Ôn thi đã dùng Google Authentication và Firestore của dự án riêng `avilog-atpl`, database `(default)` tại `asia-southeast1`. Kho ATPL tài khoản theo UID và ngân hàng, kho khách theo khóa cũ. Bộ điều phối tài khoản đã hỗ trợ thay đổi giữa các tab, chặn thao tác của phiên cũ và mở lại offline. Cấu hình hiện tại chưa có Firebase Storage; gói đã ghi nhận ở lần phát hành trước là Spark.

Phương án chọn: tái sử dụng danh tính Google và Firestore hiện có; thêm kho cục bộ theo UID cho logbook và Firebase Storage cho ảnh riêng tư. Railway tiếp tục phục vụ app, nguồn câu hỏi và ảnh giáo trình công khai. Không tải ngân hàng câu hỏi lên Storage cá nhân.

Phương án khác đã cân nhắc: giữ Google nhưng lưu ảnh qua API và bộ nhớ bền vững trên Railway. Phương án này cần thêm kiểm tra token phía server, API ảnh và vận hành sao lưu. Người dùng chọn Firebase Storage; không xây thêm hệ thống lưu ảnh Railway song song.

Đặc tả này mở rộng phạm vi của đặc tả ATPL ngày 20/10/2026: điều khoản cũ “logbook chỉ nằm trên máy” được thay bằng cơ chế nhập có xác nhận và đồng bộ theo UID dưới đây. Các bảo đảm ATPL khác vẫn áp dụng. Không sửa tài liệu cũ để làm sai lịch sử phát hành.

## 3. Phạm vi dữ liệu

| Phần app | Dữ liệu theo tài khoản, được đồng bộ | Phần giữ trên từng thiết bị |
|---|---|---|
| Hồ sơ | Tên hiển thị do người dùng đặt, home base | Danh tính Google đã nhớ phục vụ mở offline; không phải bằng chứng xác thực cloud |
| Lịch bay / duty | Chuyến, Scheduled, duty, report/release, liên kết chuyến–duty, ghi chú | Tháng/ngày đang xem, tìm kiếm và bản nháp chưa bấm lưu |
| Logbook | Actual, trạng thái xác nhận, tàu bay, vai trò, giờ PIC/Night, takeoff/landing, nguồn, ghi chú | Tệp xuất đã tải xuống và bản nháp đang sửa |
| Crew | Hồ sơ crew và liên kết trong chuyến | Không có danh bạ dùng chung giữa các tài khoản |
| Thống kê | Tính lại từ dữ liệu của tài khoản, chỉ cộng Actual đã xác nhận như hiện tại | Bộ lọc và màn hình đang xem; không đồng bộ các tổng số như một nguồn độc lập |
| Cài đặt | Tên/base, các lựa chọn nhắc lịch, leadMinutes, eveningHour | Quyền Notification, bật thông báo trên thiết bị, danh sách nhắc đã hiển thị, tình trạng cache |
| Ảnh minh chứng | Tệp gốc, SHA-256, loại, kích thước và liên kết chuyến | Bản ảnh đã tải về để xem offline, tiến độ truyền và lỗi trên máy này |
| Thùng rác | Trạng thái lưu trữ/khôi phục của bản ghi, đủ dữ liệu phục hồi | Không tự dọn bản chưa đồng bộ |
| Ôn thi | Tiến độ, bookmark, phiên học/thi, lịch sử, cài đặt theo cơ chế đã phát hành | Cache môn/ảnh đã tải; giữ cách lưu và xuất của ATPL |

Mỗi hồ sơ crew thuộc workspace của chủ tài khoản, không phải tài khoản Google của người crew đó. Không dò email crew hoặc chia sẻ logbook cho crew. Không xin quyền đọc Gmail, Google Drive, Contacts hoặc Calendar.

Weather vẫn cần mạng để lấy dữ liệu mới. OCR vẫn theo khả năng tải mô hình của luồng hiện tại; không hứa OCR mới hoặc bản tin mới khi offline. Các hạn chế này hiển thị rõ, không chặn nhập tay. Không thêm FTL hãng, push khi app đóng, thanh toán Free/Pro, xếp hạng, quyền giảng viên hoặc chia sẻ công khai trong đợt này.

## 4. Tài khoản chung và chuyển tài khoản

Trang chính hiển thị đăng nhập Google khi đang là khách; khi đã chọn tài khoản hiển thị tên/email, trạng thái đồng bộ, Đồng bộ ngay và Đăng xuất. Thiết kế phải dùng được trên màn hình điện thoại, không giấu nút trong riêng Ôn thi. Cài đặt có phần quản lý dữ liệu/offline và trạng thái ảnh.

Dùng Firebase UID làm khóa sở hữu; email, tên hoặc avatar không làm khóa dữ liệu. Giữ nguyên Google provider, Firebase app identity và cơ chế proxy `/__/auth/` đã kiểm thử. Redirect cho mobile/iPad desktop UA, popup desktop và fallback như bản hiện tại. Không tạo tài khoản app hoặc mật khẩu thứ hai.

Tách bộ điều phối tài khoản thành thành phần dùng chung nhưng giữ tương thích các đường dẫn/khóa bootstrap ATPL hiện hữu. Không có hai bộ lựa chọn tài khoản hoạt động độc lập. Không đổi namespace ATPL đang chứa tiến độ. Đồng nhất thông báo chuyển tài khoản, logout, token hết hạn và BFCache giữa trang chính, thư viện và các ngân hàng.

Khi tài khoản đổi, tăng generation ngay, dừng listener/queue cũ, hủy truyền ảnh đang chạy, đóng form/preview thuộc tài khoản cũ và thu hồi Blob URL. Mỗi thao tác async và mỗi lần ghi phải kiểm tra UID + generation trước lẫn sau công việc bất đồng bộ; IDB transaction kiểm tra lại chủ sở hữu trước commit. Không cho kết quả OCR, file picker, cloud pull hoặc callback upload từ A đi vào B.

Đổi tài khoản/đăng xuất không xóa dữ liệu đã lưu hoặc queue chưa gửi của A. Chuyển UI về đúng kho B hoặc kho khách; không gộp ngầm. Bản nháp chưa lưu phải được lưu bản phục hồi cục bộ theo A trước thao tác chuyển do người dùng bấm; nếu không lưu được thì giữ form, cho xuất phục hồi hoặc chủ động xác nhận bỏ bản nháp rồi mới chuyển. Không khóa người dùng trong trạng thái không thể đăng xuất chỉ vì quota. Thay đổi tài khoản từ tab khác chặn form cũ ngay; chỉ cho xuất phục hồi, không lưu sang tài khoản mới.

Đăng nhập lần đầu, đổi sang tài khoản chưa có phiên và đăng nhập lại sau khi đăng xuất cần mạng. Phiên tài khoản còn được ghi nhớ có thể mở dữ liệu đã tải offline, kể cả khi token chưa thể làm mới; trạng thái phải nói rõ chưa xác thực cloud. Không cho chọn một UID tùy ý để mở cache sau khi đã đăng xuất. Đây là phân tách trong ứng dụng; dữ liệu offline không được quảng cáo là mã hóa đầu cuối hoặc được bảo vệ khỏi người có quyền truy cập hồ sơ trình duyệt của thiết bị.

## 5. Kho cục bộ và hợp đồng lưu offline

Giữ nguyên database/khóa logbook cũ làm kho khách và nguồn phục hồi, không đổi tên hoặc ghi dữ liệu tài khoản vào đó. Dùng database mới `avilog-workspaces-v1`, schema phiên bản 1, gồm các store sau:

| Store | Khóa / nội dung |
|---|---|
| `workspaces` | UID; snapshot cục bộ, revision cloud đã nhận, schemaVersion |
| `outbox` | UID + operationId; thay đổi bất biến, bản nền và chuỗi thao tác cục bộ |
| `conflicts` | UID + conflictId; bản nền, bản máy, bản cloud, nhóm trường xung đột |
| `blobs` | UID + SHA-256; byte ảnh gốc (ArrayBuffer trong IDB để tương thích WebKit), MIME, số byte, trạng thái xác minh; API đọc trả Blob |
| `transfers` | UID + transferId; hàng đợi ảnh, trạng thái gửi/nhận, tham chiếu và retry |
| `recoveries` | UID/guest + recoveryId; snapshot trước nhập, nguồn nguyên bản hoặc bản nháp phục hồi |
| `devicePreferences` | UID; cài đặt riêng thiết bị, không xuất lên Firestore |

Một lần Lưu thành công phải commit snapshot + operation + Blob mới/transfer liên quan trong cùng transaction IndexedDB. Hiển thị thành công chỉ sau `oncomplete`. Nếu hết dung lượng, transaction abort hoặc trình duyệt từ chối lưu thì giữ màn hình nhập và báo chưa lưu; không báo đã lưu/đã đồng bộ. Không thay snapshot đang dùng bằng một phần dữ liệu đọc lỗi.

Mỗi UID/workspace có một writer sử dụng Web Locks; các tab khác xem và có thao tác tiếp quản rõ ràng sau khi writer đã nhả lock. ATPL tiếp tục dùng lock riêng theo ngân hàng. Nếu trình duyệt không hỗ trợ cơ chế khóa bắt buộc thì workspace tài khoản chỉ đọc và cho xuất dữ liệu, không giả vờ ghi an toàn; chế độ khách theo khả năng hiện có. Đóng tab/reload/BFCache phải nhả hoặc lấy lại lock, xác minh UID và đọc lại dữ liệu bền vững trước khi cho sửa.

Khởi động đọc IndexedDB và identity đã nhớ trước, không chờ Firebase/config/network. SDK dùng bundle cục bộ; các module mới có trong shell offline. Sau một lần tải đầy đủ, mở lại app ở chế độ máy bay phải xem/sửa/lưu được dữ liệu tài khoản đã có. App không cam kết tiếp tục chạy hoặc sync khi iOS đã đóng app.

## 6. Mô hình Firestore và tính nhất quán

Giữ nguyên nhánh ATPL `users/{uid}/banks/...`. Thêm nhánh workspace `users/{uid}/workspaces/main` với:

- Document gốc: `schemaVersion: 1`, `revision` số nguyên tăng, `updatedAt` server timestamp. Không nhét toàn bộ logbook hoặc ảnh vào document này.
- `records/{recordKey}`: `kind`, ID domain, schema, revision cuối, dữ liệu và trạng thái active/archived. Kind chỉ gồm profile, preferences, flight, duty, person. Profile/preferences dùng ID cố định; các loại khác giữ ID domain. `recordKey = SHA-256(kind + NUL + id)` để ID backup không trở thành đường dẫn tùy ý.
- `flightKeys/{keyHash}`: quyền sở hữu một `flightKey` chuẩn hóa (ngày UTC + số hiệu) bởi một ID chuyến, để hai máy không tạo trùng chuyến khi dùng ID khác nhau. Hash chỉ là mã định danh, không phải cơ chế bảo mật.
- `receipts/{operationId}`: biên nhận bất biến với hash nội dung thao tác, revision, danh sách thay đổi được chấp nhận và kết quả cần để nhận lại khi mất phản hồi. Cùng operationId nhưng khác hash bị từ chối. Dữ liệu biên nhận không chứa byte ảnh hoặc token.
- `imports/{importHash}`: dấu nhập đã xác nhận và tiến độ các phần, để tiếp tục sau gián đoạn; phân biệt bản nhập hoàn tất với bản nhập một phần.

Mọi transaction ghi workspace phải đọc/kiểm tra document gốc, các record/flightKey liên quan và receipt rồi cập nhật revision gốc cùng kết quả. Dùng optimistic transaction/precondition của server để retry khi có writer khác, không dùng giờ máy làm trọng tài. Không sử dụng Firestore whole-document last-write-wins cho logbook offline. Firestore persistent cache không phải queue chính; IDB là nguồn cho khả năng mở offline và trạng thái chờ gửi.

Mỗi transaction chỉ chứa nhóm thay đổi nhỏ; giới hạn ứng dụng: tối đa 8 record domain, record tối đa 128 KiB JSON UTF-8, toàn yêu cầu/receipt tối đa 800 KiB. Phải tính cả document flightKey/receipt và số lần truy cập rules trong kiểm thử thật. Nếu vượt, không cắt chuỗi hoặc bỏ trường; chia thao tác bulk theo mục dưới đây, hoặc giữ bản lỗi ở máy với lý do cụ thể. Không thay giới hạn 6 MiB ảnh bằng giới hạn document Firestore.

Pull ban đầu và khi revision gốc thay đổi: đọc root revision, phân trang records theo document ID (100/document page), đọc lại root. Chỉ công bố snapshot mới sau khi hai revision bằng nhau và toàn bộ schema/liên kết hợp lệ. Nếu thay đổi trong lúc đọc, bỏ snapshot tạm và thử lại, tối đa 3 lần trong một lượt; sau đó giữ snapshot cũ, báo đang chờ lượt sau. Không nâng checkpoint bằng một tập trang không nhất quán. Bản đọc được commit vào IDB cùng rebase của queue; lỗi không xóa snapshot cũ.

Theo dõi document gốc, không đăng ký listener cho từng chuyến. Không kéo lại toàn bộ logbook khi chỉ gõ vào form, chạy đồng hồ hoặc xem thống kê. Receipt có thể cập nhật trực tiếp snapshot nếu nó nối đúng revision cục bộ; nếu có khoảng trống revision thì phải pull nhất quán. Cách này ưu tiên kiểm chứng tính đúng; đọc toàn bộ khi có thay đổi từ máy khác có chi phí đọc, phải ghi nhận khi nghiệm thu với 10.000 chuyến. Không quảng cáo chi phí cố định hoặc miễn phí vô hạn.

Bulk import chia nhóm có biên nhận, đưa crew và duty lên trước các chuyến tham chiếu. Gián đoạn giữ trạng thái “đã gửi X/Y”, không báo hoàn tất; retry chỉ tiếp tục nhóm chưa nhận. Chỉnh sửa thông thường không cần đợi bulk khác kết thúc ngoài các record bị phụ thuộc. Không biến bulk thành một document lớn.

## 7. Gửi, nhận và xung đột

Mỗi operation lưu `operationId`, UID, deviceId, schema, sequence cục bộ, bản nền/revision đã thấy và thay đổi theo nhóm trường. ID bất biến được tạo trước lần gửi đầu tiên; timeout không tạo ID mới. Chỉ xóa operation đã được receipt xác nhận sau khi kết quả nhận và phần thay đổi phát sinh sau lúc gửi đã cùng được lưu bền vững. Cloud lỗi sau khi ghi nhưng trước phản hồi phải được thử lại bằng cùng ID, không nhân đôi chuyến hay lần nhập.

Các operation sửa cùng record được gửi theo quan hệ nhân quả, không gửi bản con trước bản cha. Receipt phải phân biệt accepted, already-applied và conflict; conflict không phải xác nhận đã nhận thay đổi của người dùng. Giữ nguyên bản nền và bản máy của operation bị conflict trong recovery/conflicts; các bản con phụ thuộc record đó chờ giải quyết, các record độc lập tiếp tục. Receipt và operation đã bắt đầu gửi không bị sửa nội dung khi retry; xử lý xung đột tạo ID mới và giữ tham chiếu các bản bị thay thế.

Đồng bộ chạy khi mở app, lấy focus trở lại, có sự kiện online, người dùng bấm Đồng bộ ngay hoặc nhận thông báo revision mới; các tín hiệu được gộp. Backoff có giới hạn và jitter, không lặp dồn khi token/permission/schema sai. `navigator.onLine` chỉ là gợi ý, không chứng minh cloud đã nhận. Queue dữ liệu và queue ảnh độc lập; bộ điều khiển chỉ nhận client đã xác thực và token generation hiện hành.

Rebase ba phía: nền mà máy đã thấy, bản đang sửa, bản server mới nhất. Đổi ở các nhóm độc lập được gộp nếu kết quả qua validation domain; cùng nhóm bị cả hai bên đổi thành giá trị khác nhau thì tạo conflict. Cùng giá trị được coi là hội tụ. Xóa trường khác với không có thay đổi; không dùng giá trị falsy để suy ra xóa.

Nhóm trường chuyến:

| Nhóm | Quy tắc |
|---|---|
| Danh tính chuyến | date + flightNo; đổi cùng nhau và kiểm tra flightKey |
| Scheduled | Toàn bộ scheduled; không ghép riêng OUT của máy A với IN của máy B |
| Actual / xác nhận | actual, confirmed, dep/dest, aircraft/reg, role, PIC/Night, takeoff/landing, captain/FO/crew và source; một nhóm để giữ các ràng buộc thống kê |
| Note / confidence | Mỗi trường riêng; cùng trường cùng sửa thì yêu cầu chọn |
| Duty | dutyId; xử lý cùng trạng thái duty khi hiển thị |
| Ảnh | Tham chiếu ảnh mong muốn; hai máy thay ảnh khác nhau không tự chọn |
| Lưu trữ | active/archived và thông tin phục hồi; archive đấu với edit là conflict |

Profile/preferences gộp theo từng trường, duty theo nhóm identity, report/release và note; mỗi hồ sơ crew là một đơn vị để tránh ghép tên của người này với rank của phiên bản khác. Kết quả gộp phải qua kiểm tra UTC, OUT ≤ OFF ≤ ON ≤ IN, PIC/Night trong block, captain khác FO, liên kết crew và điều kiện confirmed hiện có.

Nếu bản cloud đã confirmed mà một operation dựa trên bản chưa confirmed định sửa nhóm Actual thì phải yêu cầu xem lại, dù thuật toán thường có thể gộp. Người dùng từng tick cho phép sửa ở bản cũ không đồng nghĩa cho phép ghi đè bản confirmed mới chưa xem. Roster import không thay Actual đã xác nhận.

Màn hình xung đột ghi rõ chuyến/người/duty, bản máy, bản cloud và các trường khác nhau; cho giữ cloud, dùng bản máy sau xác nhận hoặc chỉnh lại. Có xuất bản phục hồi trước khi bỏ một phiên bản. Giải quyết tạo operation mới dựa trên revision vừa xem; nếu cloud lại đổi, kiểm tra lại. Operation xung đột được tách ra để không chặn những record khác. Chưa xử lý xung đột thì không báo “toàn bộ đã đồng bộ”.

Hai ID tạo cùng flightKey chỉ có một bản active chính thức; bản còn lại ở khu vực xung đột/queue, không cộng đôi vào thống kê sau khi phát hiện. Cho xem và gộp thông tin có kiểm tra, không tự thêm hậu tố số hiệu để né trùng.

Không overwrite nội dung form đang mở bằng snapshot nhận nền. Giữ revision/bản nền của form; thông báo có thay đổi cloud và chạy rebase khi Lưu. Thống kê chỉ dựa trên snapshot domain đang hiển thị, kèm cảnh báo có thay đổi/xung đột chưa gửi nếu có.

## 8. Thùng rác và liên kết

Archive là tombstone có revision và đủ dữ liệu khôi phục, không delete vật lý record hoặc ảnh. Pull không làm sống lại record đã archived chỉ vì một máy offline còn bản cũ. Edit đấu với archive cần giải quyết; restore là thao tác mới có receipt và kiểm tra trùng ID/flightKey.

Để archive một duty có nhiều chuyến không vượt transaction lớn, giữ liên kết dutyId trong dữ liệu bền vững và đánh dấu duty archived; lớp domain hiển thị duty đã bỏ và không coi liên kết đó là duty active. Khôi phục duty khôi phục liên kết chỉ với chuyến còn trỏ tới duty đó. Chuyến đã được người dùng chuyển sang duty khác hoặc bỏ liên kết rõ ràng không bị kéo trở lại. UI/domain adapter phải giữ hành vi hiện có ở mức người dùng nhìn thấy; không phát ra hàng nghìn lần xóa liên kết khi archive một duty.

Không giới thiệu nút xóa vĩnh viễn tài khoản/cloud trong đợt này. Tài liệu riêng tư giải thích dữ liệu archived, ảnh thay thế và upload mồ côi được giữ để phục hồi; không hứa đã xóa khỏi cloud khi người dùng chỉ bỏ ảnh khỏi một chuyến. Không bật lifecycle/garbage collection tự động có thể làm mất ảnh của một thiết bị offline. Việc dọn vĩnh viễn là thay đổi riêng cần thiết kế và kiểm tra tham chiếu.

## 9. Ảnh minh chứng: lưu gốc, truyền riêng, xem offline

Giữ khả năng một ảnh/chuyến của app hiện tại, chỉ JPG/PNG/WebP, `0 < bytes ≤ 6 × 1024 × 1024`. Kiểm tra MIME, nhận dạng/giải mã ảnh và byte; từ chối SVG/HTML hoặc tệp đổi đuôi. Không tự nén, thay ảnh gốc hay bỏ metadata ảnh mà không báo. Tên tệp người dùng không làm đường dẫn cloud. Không lưu data URL vào Firestore.

Blob được lưu cục bộ theo UID + SHA-256; metadata gồm digest, MIME, bytes và phiên bản schema. Object cloud dùng `users/{uid}/evidence/v1/{sha256}`. Cùng byte trong cùng UID được dùng lại; không deduplicate xuyên tài khoản. SHA-256 do client kiểm chứng byte tải lên/tải về, không mô tả Storage Rules như một bộ tự kiểm tra hash nội dung.

Luồng ảnh mới:

1. Xác thực ảnh và lưu Blob + flight metadata + operation/transfer trong một transaction IDB. Lưu chuyến không chờ upload.
2. Gửi metadata chuyến với digest ảnh mong muốn và trạng thái chưa sẵn sàng trên cloud. Máy khác nhìn thấy chuyến và “Ảnh đang chờ tải lên”; không có URL giả.
3. Upload resumable khi có phiên hợp lệ. Bản cục bộ luôn còn để thử lại sau reload, kể cả khi phiên resumable cũ không thể tiếp tục. Không bật upload đồng thời quá 2 ảnh.
4. Sau upload xác nhận object/kích thước/loại, cập nhật trạng thái ảnh bằng operation riêng, chỉ nếu digest mong muốn của chuyến vẫn khớp. Callback của ảnh A không được gắn vào chuyến đã đổi sang B. Nếu phản hồi thất lạc và object đã tồn tại, đọc lại byte qua SDK và xác minh trước khi coi là thành công; không overwrite một object bất biến để né lỗi.
5. Máy nhận dùng SDK `getBlob`/`getBytes` có xác thực và giới hạn byte, kiểm tra SHA-256, lưu vào IDB theo UID rồi tạo Blob URL để hiển thị. Không dùng URL download có token làm liên kết chia sẻ lâu dài hoặc nhúng vào backup/cloud record.

Storage rules chỉ cho Google UID sở hữu đọc/tạo object đúng prefix, kích thước và MIME hợp lệ; deny overwrite, sửa metadata và delete từ client. Không public-read bucket hoặc dùng CORS như cơ chế phân quyền. CORS chỉ cho origin AviLog hiện tại, phương thức/header cần cho SDK; localhost chỉ ở cấu hình phát triển. Luồng upload/download thật phải kiểm tra CORS sau khi triển khai.

Nếu ảnh bị thay/bỏ trước upload thì hủy transfer không còn tham chiếu. Nếu upload đã hoàn thành mà callback không còn hợp lệ thì giữ object không gắn vào chuyến mới; không báo dữ liệu bị xóa khỏi cloud. Ảnh cũ dùng trong trash/recovery không bị dọn tự động.

Ảnh có các trạng thái riêng: **Đã lưu trên máy**, **Chờ tải lên**, **Đã có trên cloud**, **Chưa tải về máy này**, **Sẵn sàng offline**, **Lỗi/Thử lại**. Tải khi xem ảnh, hoặc bấm **Tải ảnh để dùng offline** cho toàn bộ ảnh đang có quyền truy cập của workspace, gồm cả ảnh trong thùng rác. Có tiến độ X/Y, byte, thiếu/hỏng và dung lượng; không báo hoàn tất khi chỉ có metadata.

Ảnh chưa gửi từ máy A không thể tải trên B; B phải thấy lý do này. Bucket/rules/quota/ mạng lỗi không chặn ghi chuyến không có ảnh. Không tự dọn Blob chưa upload, đang dùng hoặc thuộc recovery. Nếu người dùng giải phóng cache ảnh đã có trên cloud, xác nhận phạm vi UID và nói rõ sẽ không xem được offline đến khi tải lại. Dung lượng trình duyệt có thể bị hệ điều hành thu hồi; app kiểm tra hiện trạng, không hứa cache tồn tại vĩnh viễn.

## 10. Chuyển dữ liệu khách và backup/restore

Tài khoản lần đầu bắt đầu với workspace trống, không copy sampleState. Hồ sơ lấy tên Google làm gợi ý có thể sửa; base dùng mặc định hiện tại và không suy đoán từ email. Phát hiện kho khách cũ thì đưa lựa chọn **Xem và nhập dữ liệu trên thiết bị** hoặc **Để sau**. Không tự upload chỉ vì người dùng vừa đăng nhập.

Preview ghi rõ tài khoản đích/email; số chuyến, duty, crew, ảnh và tổng byte; hồ sơ/cài đặt nào được nhập; trạng thái demo; số trùng ID/flightKey, Actual confirmed được giữ, xung đột và các lỗi bị chặn. Dữ liệu demo không nhập mặc định; người dùng phải chủ động chọn nếu thật sự muốn. Dữ liệu trộn mẫu/thật cần người dùng xem và chọn, không đoán theo tên crew. Không lấy email/UID trong backup thay cho danh tính do Google xác thực.

Trước xác nhận nhập, lưu recovery nguyên bản cục bộ và cho xuất backup. Nếu không lưu được recovery thì không bắt đầu nhập. Nhập IDB bền vững trước, sau đó đồng bộ theo các nhóm có receipt. Giữ nguyên kho khách để quay lại/xuất; không đổi key `state`, không gộp dữ liệu account trở lại guest. Bản nhập ghi importHash chuẩn hóa nội dung đã chọn, không gồm UID/giờ nhập/deviceId; dấu cloud vẫn nằm dưới UID đích. Cùng bộ dữ liệu nhập trên hai máy không tạo đôi chuyến, crew hoặc ảnh; ID trùng nhưng nội dung khác đi qua xử lý xung đột.

Giữ đọc được backup JSON v1 hiện tại và CSV export. Backup mới có định dạng versioned cho workspace, metadata account nguồn, raw dữ liệu domain, trash, revision/bản nền, queue/conflicts và danh mục ảnh kèm byte khi có. Account nguồn chỉ để nhận biết, không phải quyền cho app ghi sang UID đó. Import sang UID đang đăng nhập luôn xem trước và xác nhận, không đổi tài khoản dựa vào nội dung file. Không xuất token, credential, URL upload resumable hoặc cấu hình emulator.

Cung cấp hai loại xuất: backup workspace để restore, và gói phục hồi cục bộ chứa queue/conflict/ảnh chưa gửi. Backup workspace chỉ được gọi **đầy đủ ảnh** khi đã có byte của mọi ảnh được tham chiếu (kể cả trash); nếu còn thiếu, cho tải nốt khi online hoặc xuất bản **thiếu ảnh** có manifest chi tiết. Không xuất một link cloud rồi mô tả đó là ảnh đã sao lưu.

Giữ hỗ trợ import v1 ≤ 50 MiB. Để nhiều ảnh không đụng giới hạn JSON này, backup workspace mới dùng nhiều phần JSON tự chứa, mỗi phần ≤ 50 MiB, cùng backupSetId, tổng số phần, chỉ số và SHA-256 trong manifest; byte ảnh là data URL trong phần tương ứng. Không phụ thuộc ZIP mới. Tải/khôi phục từng phần có tiến độ và tiếp tục được; chưa đủ phần thì không báo restore đầy đủ. Một phần lỗi không xóa dữ liệu đã có. Giới hạn hiện tại tối đa 10.000 flights trong bản nhập tiếp tục được kiểm tra; không cắt bớt chuyến ngầm.

Export chụp một snapshot/revision cục bộ cố định và pin các digest ảnh của snapshot đó; mọi phần thuộc cùng snapshot, không lấy phần sau từ dữ liệu đang tiếp tục đổi. Nếu tải byte thiếu từ cloud, chỉ nhận đúng digest đã chụp. Manifest định danh từng phần bằng hash; không dùng hash vòng tự bao gồm chính nó. Restore phát hiện lẫn backupSetId, trùng chỉ số khác hash và UID đổi giữa các phần; bản tạm thuộc UID ban đầu, không tiếp tục vào tài khoản mới.

Backup ATPL hiện tại và định dạng/namespace của nó tiếp tục giữ riêng, truy cập từ cùng tài khoản. Trang Backup toàn app có liên kết và tình trạng từng khu vực để người dùng không hiểu một file logbook đã chứa cả Ôn thi. Không làm định dạng backup ATPL mới hoặc thay thuật toán nhập ATPL trong đợt này.

Restore chỉ gộp đã xem trước, giữ Actual hiện có đã confirmed như hành vi cũ; không lấy backup cũ ghi đè nguyên workspace cloud. Nếu người dùng cần chỉnh Actual, dùng editor/xử lý xung đột với xác nhận cụ thể. Không khôi phục quyền thông báo của thiết bị khác.

## 11. Trạng thái, lỗi và riêng tư

Thanh tài khoản hiển thị trạng thái tổng hợp của các khu vực kèm chi tiết: tài khoản, logbook, ảnh và Ôn thi. **Đã đồng bộ toàn bộ** chỉ khi queue dữ liệu rỗng, mọi ảnh được tham chiếu đã gửi, không conflict và mỗi khu vực đã kiểm tra cloud thành công trong lượt hiện tại. Bank chưa mở/kiểm tra không được suy ra là đã đồng bộ; dashboard nói “Ôn thi: kiểm tra trong Ôn thi” cho đến khi có trạng thái đáng tin cậy theo UID. Không bắt tải toàn bộ ngân hàng để mở trang chính.

Thông báo phân biệt: khách/lưu trên thiết bị; offline/chờ gửi; đang đồng bộ X/Y; dữ liệu đã gửi còn N ảnh; có xung đột; cần đăng nhập lại; lỗi quyền/cấu hình; thiếu dung lượng. “Đã đồng bộ lúc …” chỉ cho khu vực thực sự có xác nhận cloud, không lấy thời gian lần sửa hoặc dấu online. Số đếm ở dashboard phải gắn UID; kết quả cũ của A không hiển thị cho B.

Lỗi auth/token dừng cloud nhưng cho dùng cache của tài khoản đang chọn. Lỗi rules hoặc schema dừng retry tự động gây lặp; giữ bản xuất phục hồi và thông báo lỗi có hành động. Lỗi ảnh chỉ chặn trạng thái hoàn tất của ảnh. Lỗi pull không xóa local. Xung đột một record không đóng băng các record khác. Dữ liệu chưa tải trên thiết bị mới phải hiển thị “chưa tải”, không giả là workspace trống hoặc tự tạo demo khi fetch lỗi.

Firestore/Storage đều default-deny, kiểm tra UID từ token Google; A không được đọc/ghi/list dữ liệu B dù thay path, email, metadata hoặc cached account. Rules kiểm tra schema, kind, trường được phép, giới hạn và tính bất biến của receipt/object; dùng emulator với unauth, A, B và token không phải Google. Mọi đường dẫn khác giữ deny; không nới wildcard để dễ thử. Business merge/confirmed là bảo vệ dữ liệu của chính người dùng trong app, không quảng cáo rules có thể ngăn chủ tài khoản tự sửa dữ liệu của mình bằng client khác.

Ảnh riêng tư không vào service-worker public cache `avilog-shell-*`/`avilog-atpl-v1`. Auth/API và request có credential không được cache kiểu static; chỉ các asset/config công khai có quy tắc cache tường minh. Thu hồi Blob URL, xóa nội dung DOM riêng tư khi đổi UID, guard export/import/file async và kiểm tra BFCache. Không log token, byte ảnh, nội dung logbook, email/UID đầy đủ trong report công khai hoặc URL.

Cập nhật privacy/README từ “logbook chỉ lưu trên máy” sang danh mục dữ liệu cloud, Google identity, lưu offline, cơ chế nhập, vùng lưu trữ, ảnh/record lưu trữ để phục hồi và các giới hạn. Không hứa mã hóa đầu cuối. Thiết bị dùng chung cần đăng xuất và quản lý bản sao offline; không xóa cache chưa gửi chỉ để che cảnh báo.

## 12. Firebase Storage, chi phí và cấu hình

Dùng đúng dự án `avilog-atpl`, không tạo dự án khác hoặc dùng dự án không liên quan. Giữ nguyên Auth provider, OAuth client, Firestore location, UID và dữ liệu ATPL. Chỉ thêm bucket/Storage rules và trường public config cần thiết như bucket name/feature flags. Không thêm Analytics, Gemini, Cloud Functions, tài khoản service-account hoặc khóa bí mật vào client. Bundle Firebase Storage cùng SDK đã pin và kiểm tra lại dependency advisory liên quan; không tự nâng major để né kiểm thử.

Firebase Storage hiện yêu cầu Blaze liên kết Cloud Billing. Người dùng đã đồng ý phương án có thể có phí; thao tác liên kết cần đúng billing account của chủ dự án và sự tham gia của họ khi Google yêu cầu. Không tự chọn một billing account không rõ chủ sở hữu hoặc chấp nhận điều khoản thay người dùng. Viết spec/kế hoạch không kích hoạt thay đổi có phí.

Chọn bucket regional Singapore để gần database đang ở Singapore nếu console hỗ trợ; xác minh chính xác location code trước tạo và ghi vào hồ sơ triển khai. Nếu không có lựa chọn tương ứng, dừng bước tạo bucket và đưa lựa chọn cụ thể cho người dùng; không chọn vùng khác ngầm hoặc đổi Firestore location.

Trước kích hoạt live: trình bày region, gói tính theo sử dụng, các thành phần phí lưu trữ/upload/download/Firestore, dung lượng ảnh thực đo và lựa chọn cảnh báo chi phí bằng tài khoản chủ dự án. Không hứa một mức phí khi chưa biết lưu lượng. Xác nhận mức cảnh báo cụ thể lúc đó; cảnh báo ngân sách thông thường không phải giới hạn chi tiêu cứng cho Storage. Giới hạn tệp 6 MiB, dedup cùng UID, tải ảnh có chủ đích và tối đa 2 transfer giúp hạn chế sử dụng nhưng không bảo đảm hóa đơn tối đa.

Ảnh upload mồ côi, ảnh thay thế, trash và receipt có thể tiếp tục tốn dung lượng; phải nêu trong hướng dẫn. Nếu chi phí/quota/provider bị chặn, có cờ tắt cloud workspace hoặc ảnh độc lập, vẫn giữ local, queue và xuất backup. Không tự hạ gói/xóa bucket hoặc tắt billing toàn dự án vì có thể làm gián đoạn ATPL và mất truy cập ảnh.

## 13. Bảo toàn ngân hàng và offline ATPL

Mốc nguồn SHA-256: `28fbacae42e5b05023c89b077d977e62184a2e916da0dc7d14bd521acd89239f`. Engine SHA-256: `d2500d598ca2c997459d1c2f10b6ce72e78eee7a2ea5b93e137dc1d540625872`. Các bankSHA256 lấy từ catalog ở commit baseline, phải so sánh tự động trước/sau; không tính lại baseline từ bản đã sửa rồi tự coi là bằng chứng.

Số lượng baseline: POF 487, COM 500, INS 601, MET 900, RNAV 700, LAW 453, MB 300, MBR 300, AGK 782, PERF 399, OPS 501, HUM 503; tổng 6.426 gồm 6.126 câu nguồn và 300 câu MBR tham khảo riêng. Giữ nguyên cả trường hợp nhãn lựa chọn/đáp án đặc biệt và vị trí thiếu của nguồn, không sửa ngân hàng dưới danh nghĩa nâng tài khoản.

Chỉ thay wrapper/bootstrap/UI tài khoản ngoài engine nếu cần. Giữ mọi payload câu hỏi/lời giải/trích dẫn/ảnh nguồn, UID, thứ tự/lựa chọn, key đúng, cách tính điểm, đường dẫn ảnh theo hash và tiến độ tài khoản đang có. Nếu cần đổi URL HTML vì wrapper đổi, cập nhật catalog/manifest bằng quy trình đóng gói hiện hữu, giữ cache `avilog-atpl-v1` và ảnh hash cũ; không xóa cache môn trong SW upgrade.

Đăng nhập từ trang chính phải được nhận trong bank và ngược lại; logout một nơi phải khóa writer cũ ở mọi nơi. Không làm mất phiên đang học chỉ vì workspace logbook pull, đổi tên hồ sơ hoặc upload ảnh. Học/thi tiếp tục chạy khi Firestore/Storage không hoạt động. Tải môn và ảnh nguồn vẫn là thao tác offline hiện có, không phụ thuộc bucket riêng tư.

## 14. Ranh giới thành phần và phạm vi sửa

| Thành phần | Trách nhiệm / giao tiếp |
|---|---|
| Account coordinator chung | UID, generation, trạng thái đã nhớ, login/logout, thông báo giữa tab; wrapper tương thích ATPL |
| Account client | Auth thật, token validation, config, cung cấp transport theo UID; không trực tiếp render hoặc sửa domain |
| Workspace repository | IDB, transaction lưu, namespace, writer lock, đọc snapshot, phục hồi; API không cần mạng |
| Workspace model | Validation, thay đổi theo nhóm, rebase, trùng flightKey, tombstone; thuần để kiểm thử |
| Workspace controller/transport | Retry, transaction/receipt, pull nhất quán, ack/rebase; không thao tác DOM |
| Evidence repository/transfer | Blob, digest, Storage upload/download, trạng thái offline; guard UID/generation |
| Migration/backup | Preview, raw recovery, dedup import, nhiều phần backup; không tự đăng nhập hoặc upload trước xác nhận |
| UI trang chính | Form, trạng thái, conflict review, account/backup/offline controls; chỉ render dữ liệu đã được repository chọn |
| ATPL bridge | Dùng account chung, tiếp tục adapter/engine/namespace hiện hành; không phụ thuộc model logbook |

Sửa có mục tiêu `public/app.js`, adapter storage/domain liên quan, shared account modules, nguồn/bundle Firebase, UI/styles, shell SW, public config, rules/emulator config, tests và tài liệu. Tách logic mới khỏi app.js đang lớn; không refactor unrelated weather/import parser. Chỉ sửa server nếu cần public config; không thêm server logbook API vì client đã dùng Firebase.

Không sửa `sources/` hoặc dữ liệu tham chiếu đồng bộ từ Project. Không cập nhật ngân hàng hoặc diễn giải mới trong phạm vi tài khoản. Dữ liệu kiểm thử phải tổng hợp; không đưa logbook, crew thật hoặc ảnh cá nhân vào Git/fixture công khai.

## 15. Kiểm thử và điều kiện nghiệm thu

Các kiểm tra phải chạy trên code triển khai sau này; viết đặc tả không chứng minh app đã có tính năng.

| Nhóm | Bằng chứng bắt buộc |
|---|---|
| Lưu local | Snapshot + queue + Blob atomic; abort/quota giữa chừng không báo thành công; reload không mất dữ liệu đã báo lưu |
| Offline | Tắt mạng thật của browser context, đóng/mở lại: sửa chuyến, duty, crew, cài đặt; thêm ảnh, xem ảnh đã tải, backup, học/thi/bookmark/resume; không cần tải SDK từ CDN |
| Hai thiết bị | A sửa rồi sync, B nhận cùng UID; cả hai offline sửa nhóm khác nhau rồi hội tụ; sửa cùng nhóm có conflict; lệch đồng hồ không thắng phiên mới |
| Retry | Mất phản hồi sau server commit, retry cùng ID không trùng; thay đổi mới lúc đang gửi được giữ; import tiếp tục đúng phần |
| Domain | Confirmed Actual được bảo vệ, roster không ghi đè; validation UTC/block/PIC/Night; trùng flightKey khác ID; archive/edit/restore và liên kết duty/crew |
| Cách ly UID | A/B/guest riêng trong IDB/UI/backup/ảnh; đổi khi form/OCR/file/upload/pull đang chạy; logout tab khác; BFCache; không lộ kết quả A vào B |
| Ảnh | 6 MiB boundary, sai MIME/nội dung, đúng byte/hash; lỗi/mất mạng giữa upload/download; thay/bỏ ảnh lúc đang gửi; cùng ảnh dedup cùng UID, không dedup A/B; tải lại offline và báo thiếu đúng |
| Migration | Có/không nhập, demo không tự gửi, recovery lỗi thì không nhập; hai máy nhập cùng dữ liệu; khác nội dung cùng ID; confirmed hiện có; kho khách không đổi |
| Backup | v1 hiện hữu, multipart đủ/thiếu/sai hash/lặp phần, ảnh thiếu không báo đầy đủ, queue/conflict phục hồi, import sang UID khác cần xác nhận; không có token/secret |
| Rules thật | Auth/Firestore/Storage emulator: own allowed, other/unauth/non-Google denied, path tamper/list/size/type/receipt immutability; toàn transaction trong giới hạn rules |
| Pull/hiệu năng | 10.000 chuyến tổng hợp, nhiều trang, remote đổi giữa các trang không nhận snapshot nửa chừng, không tải lại ở mỗi lần gõ/đồng hồ; ghi số read, thời gian, byte và số ảnh thực tải |
| ATPL | Payload/key/options/UID/engine hash bằng baseline toàn 12 bank; grading từ đáp án gốc; tiến độ đã có, guest import, MB/MBR, source images và cache SW không bị hỏng |
| Browser | Chromium và WebKit với mobile viewport/iPad desktop UA, account switch, storage failure, provider lỗi, redirects, lock, offline và reconnect |

Kiểm thử với emulator dùng SDK/Firestore/Storage rules thật, không chỉ mock tất cả network. Giữ các test hồi quy hiện có. Bằng chứng real Google/production và kiểm tra trên iPad vật lý phải báo riêng; WebKit mô phỏng không được gọi là iPad thật.

Điều kiện phát hành live: rules được triển khai vào đúng dự án, config/domain/CORS đúng; Google login thật từ trang chính và bank; hai thiết bị/ngữ cảnh cùng UID nhận chuyến + crew + cài đặt + ảnh; UID khác bị chặn; production origin mở lại offline với chuyến/ảnh đã tải và môn đã tải; backup/restore phục hồi được; toàn bộ hash/key nguồn không đổi. Nếu cần người dùng thao tác trên iPad/Google/billing, chuẩn bị phần còn lại và đưa bước cụ thể, không yêu cầu cung cấp mật khẩu/token.

## 16. Triển khai, bật tính năng và rollback

Đợt này là một subsystem workspace/ảnh dùng account chung, triển khai theo các lớp có interface tách biệt; không phát hành từng lớp như thể đã đồng bộ toàn app. Kế hoạch sau khi đặc tả được duyệt sẽ chia thành các phần review/test độc lập nhưng nghiệm thu cùng các hành vi ở mục 15.

Cờ workspace sync và evidence sync mặc định tắt; không tắt ATPL accounts đang chạy. Chuẩn bị local isolation, account compatibility, model, transport, backup/UI và emulator checks trước khi chạm cấu hình live. Bật ảnh chỉ khi bucket, billing đúng chủ dự án, private rules, CORS và kiểm tra dữ liệu thật đã sẵn sàng. Không upload logbook đang có của người dùng để test nếu họ chưa thực hiện bước nhập xác nhận.

Triển khai shell có version mới nhưng giữ cache môn công khai. Giữ khả năng đọc guest/backup v1, không xóa database cũ. Rollback dùng build có hiểu namespace mới và chỉ tắt sync; không quay thẳng về build cũ có một kho dùng chung khi tài khoản vẫn đang được chọn. Nếu local isolation có lỗi, khóa ghi tài khoản và cho xuất phục hồi, không đẩy dữ liệu tài khoản vào guest.

Tắt cloud phải giữ local snapshot, queue, Blob, conflict và receipt cloud. Không xóa object, rule owner restriction, Auth user hoặc dữ liệu ATPL để rollback. Mọi báo cáo release ghi baseline/new commit, kết quả test, hash preservation, tính năng đang bật, giới hạn còn lại và checklist vật lý đã/ chưa kiểm tra.

## 17. Tự rà soát đặc tả

- Phạm vi giữ đúng lựa chọn: toàn app và ảnh giữa thiết bị, không phát triển dịch vụ bên ngoài Firebase/Railway hiện có.
- Offline là lưu IDB trước, không phụ thuộc transaction Firestore; ảnh chưa tải và nguồn mới cần mạng được phân biệt rõ.
- Bảo toàn key/engine và cache ATPL có baseline, namespace tương thích và điều kiện kiểm thử riêng.
- Tài khoản Google chọn một UID toàn app; guest, logout và dữ liệu cũ không nhập/ngầm trộn.
- Xung đột, retry, confirmed Actual, duplicate flightKey, bulk import, archive/restore, backup thiếu ảnh và rollback có hành vi cụ thể.
- Không có chỗ trống quyết định kỹ thuật để người triển khai tự chọn tùy ý. Billing account và mức cảnh báo là thông tin riêng của chủ dự án cần xác nhận ở bước kích hoạt, không được tự điền.
- Chưa triển khai, chưa bật billing/bucket và chưa tuyên bố các kiểm thử mới đã chạy.

## 18. Nguồn kỹ thuật

Các quyết định Firebase phải được đối chiếu lại với tài liệu chính thức lúc kích hoạt; các liên kết dưới đây đã đọc khi viết đặc tả ngày 20/10/2026:

- [Google sign-in](https://firebase.google.com/docs/auth/web/google-signin) và [redirect best practices](https://firebase.google.com/docs/auth/web/redirect-best-practices): giữ luồng Google và same-origin proxy.
- [Firestore transactions](https://firebase.google.com/docs/firestore/manage-data/transactions): transaction online, retry khi có cạnh tranh; vì vậy không thay thế queue offline IDB.
- [Firestore quotas](https://firebase.google.com/docs/firestore/quotas): giới hạn document/transaction/rules; vì vậy không đưa byte ảnh hoặc toàn workspace vào một document.
- [Storage billing requirements](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024): Storage yêu cầu Blaze, cần billing; không cam kết Spark lưu ảnh cloud.
- [Storage rules conditions](https://firebase.google.com/docs/storage/security/rules-conditions): kiểm tra token, path, MIME, size và metadata; không tự chứng minh SHA-256 của byte.
- [Download files](https://firebase.google.com/docs/storage/web/download-files): tải trực tiếp qua SDK để dùng rules, cần cấu hình CORS cho browser.
- [Storage locations](https://firebase.google.com/docs/storage/locations): vùng bucket phải kiểm tra và ghi nhận trước tạo.
- [Avoid surprise bills](https://firebase.google.com/docs/projects/billing/avoid-surprise-bills): cảnh báo ngân sách thông thường không tự dừng Storage; không mô tả là trần chi phí.

## 19. Bổ sung của người dùng khi duyệt triển khai: thời tiết dạng chữ

Ngày 20/10/2026, người dùng yêu cầu chỉ lưu thời tiết sân bay đi và đến của chuyến trong ngày bằng dữ liệu chữ chép từ nguồn; không chụp/lưu ảnh thời tiết. Yêu cầu này thay phần mô tả Weather chỉ xem online ở §3 đối với bản chữ đã lưu: lấy bản tin mới vẫn cần mạng, bản đã lưu xem được offline và đồng bộ theo tài khoản.

Trong dữ liệu chuyến thêm nhóm `weather` độc lập: ngày chuyến UTC, tối đa hai ICAO đi/đến (trùng ICAO chỉ một), raw METAR/TAF dạng text hoặc null nếu nguồn không có, provider, URL từng sản phẩm và fetchedAt UTC. Chỉ tự thu thập cho chuyến có ngày là hôm nay theo UTC khi app đang mở; dùng chung yêu cầu/cache khi nhiều chuyến trùng sân bay, không polling nền. Nút cập nhật cho phép lấy lại có chủ đích trong ngày; snapshot trên chuyến giữ lần lấy gần nhất đã lưu thành công. Không tự chụp ảnh, vẽ bản tin thành ảnh hoặc tải thời tiết toàn bộ sân bay/lịch sử nhiều ngày.

Với chuyến quá khứ/tương lai, hiển thị bản chữ đã lưu hoặc “Chưa lưu thời tiết cho ngày chuyến”; không gán bản tin mới nhất hôm nay làm thời tiết lịch sử. Giữ nguyên nội dung bản tin, thời điểm phát hành nằm trong raw text và thời điểm lấy riêng, không diễn giải là điều kiện chính xác tại OUT/IN. Ngày mới không ghi đè snapshot ngày cũ. Lỗi API/không có dữ liệu không xóa bản text đã lưu; bản cũ có nhãn thời điểm rõ. Không thêm API archive hoặc hứa thu thập khi app đóng trong đợt này.

Nhóm weather đi qua UID guard, IDB atomic save, merge/conflict theo nhóm, Firestore và backup như metadata chuyến, không qua Storage ảnh. Kiểm thử: hai sân bay đúng ngày, dedup requests, no-data/API lỗi, midnight UTC, chuyến cũ/future không dùng latest, reload offline, account đổi trong request và export không chứa ảnh thời tiết. [NOAA AWC Data API](https://aviationweather.gov/data/api/) xác nhận raw METAR/TAF và yêu cầu giới hạn scope/tần suất; dùng proxy same-origin hiện hữu, không fetch cross-origin trực tiếp từ browser.
