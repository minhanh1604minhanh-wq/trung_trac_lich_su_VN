# WEBSITE LỊCH SỬ TƯƠNG TÁC — TRƯNG TRẮC

Bản FULL gồm frontend, backend Express, dữ liệu song ngữ, mô hình 3D, audio thuyết minh VI/EN, OpenAI TTS, PDF và cấu hình Vercel. Website không gửi hoặc lưu dữ liệu hoạt động ra dịch vụ bảng tính bên ngoài.

## File chính

- `server.js` — các endpoint `/health`, `/ask`, `/whatif`, `/roleplay`, `/speak`.
- `public/index.html`, `public/styles.css`, `public/app.js` — giao diện và hành vi tương tác.
- `public/vendor/html2pdf.bundle.min.js` — thư viện PDF đóng gói cục bộ, không phụ thuộc CDN lúc chạy.
- `public/data/trung-trac.json` — hồ sơ song ngữ, timeline, facts có `sourceId`, nguồn, gợi ý và kịch bản nhập vai.
- `public/assets/trung_trac.glb` — mô hình 3D.
- `public/assets/trung_trac_tieng_viet.mp3`, `public/assets/trung_trac_tieng_anh.mp3` — audio thuyết minh.
- `.env.example` — tên biến môi trường OpenAI, không chứa khóa thật.
- `vercel.json` — cấu hình deploy cùng domain.

## Kiểm tra project

```bash
npm run validate
node --check public/app.js
node --check server.js
```

## Chạy local

```bash
npm install
cp .env.example .env
# Điền OPENAI_API_KEY vào .env
npm start
```

Mở `http://localhost:3000`; kiểm tra `http://localhost:3000/health`.

## Upload GitHub và deploy Vercel

1. Giải nén ZIP, tạo repository GitHub và upload toàn bộ nội dung ở thư mục gốc.
2. Import repository vào Vercel.
3. Thêm Environment Variables: `OPENAI_API_KEY`, `OPENAI_TEXT_MODEL`, `OPENAI_TTS_MODEL`.
4. Deploy, sau đó mở `/health`; `ok` phải là `true` và `aiReady` là `true` khi đã cấu hình API key.

`API_BASE_URL` mặc định để trống vì frontend và backend chạy cùng domain. Không đưa file `.env` hoặc API key thật lên GitHub.


## Thông tin người tham gia

- Trước khi bắt đầu, người dùng phải nhập **Tên người tham gia**. Trường này là bắt buộc; website không tự thay bằng “Người học”.
- `Lớp` và `Trường` là tùy chọn.
- Ba giá trị chỉ được giữ trong trạng thái của phiên hiện tại và có thể lấy qua `participantSnapshot()` khi tích hợp hệ thống thống kê trung tâm sau này. Không lưu dai dẳng tên/lớp/trường trên máy kiosk.
- Bản này vẫn **không có Google Sheets** và chưa gửi dữ liệu người tham gia ra ngoài website.

## Giao diện dock

- Đã xóa pseudo-element `.tool-card::after`, là vòng tròn mờ trang trí ở góc dưới-phải của thẻ chức năng. Icon tròn thực sự của từng công cụ (`.tool-medallion`) vẫn được giữ nguyên.

## Nhập vai quyết sách

- Khi chưa có tình huống, nút hiển thị `Bắt đầu tình huống`.
- Khi tình huống đã được tạo, nút đổi thành `Bắt đầu tình huống mới`.
- Bấm nút này sẽ hủy yêu cầu/audio AI đang chạy, xóa lịch sử lượt cũ, lựa chọn, nhận xét, kết quả và chỉ số mô phỏng, đưa lượt về 1 rồi tạo tình huống mới.
- Chỉ số mô phỏng hiển thị bằng mức định tính, không phải dữ kiện lịch sử. Baseline lượt đầu: Quân sự Khá; Ngoại giao Trung bình; Lòng dân Tốt; Hậu cần Trung bình; Chính trị Khá; Quản trị Trung bình.

## Nguyên tắc nội dung

AI chỉ nhận bộ facts trong `trung-trac.json`. Khi dữ liệu không đủ, câu trả lời tiếng Việt phải ghi “Chưa đủ nguồn để khẳng định.” Các điểm về tên chồng, niên đại cuối đời và cách kể cái chết được đánh dấu là tranh luận/truyền thống thay vì khẳng định tuyệt đối.


## Analytics trung tâm (v5.8.5)

Bản này **không dùng Google Sheets**. Hoạt động người dùng được gửi an toàn theo mô hình backend-to-backend tới website quản lý.

### Vercel Environment Variables cần thêm cho website Trưng Trắc

```env
ANALYTICS_API_URL=https://quan-ly-s7j8.vercel.app
ANALYTICS_INGEST_KEY=<cùng giá trị ANALYTICS_INGEST_KEY của website quản lý>
```

`ANALYTICS_INGEST_KEY` chỉ tồn tại ở backend/Vercel, không được đưa vào `public/config.js` hoặc GitHub.

### Sự kiện được ghi
- `session_start`, `session_end`
- `page_view`, `character_open`
- `profile_open`, `timeline_view`
- `narration_play`, `narration_pause`
- `qa_open`, `ask_question`
- `whatif_open`, `whatif_question`
- `roleplay_open`, `roleplay_start`, `roleplay_new_scenario`, `roleplay_choice`, `roleplay_end`
- `language_change`, `pdf_export`

Tên người tham gia là bắt buộc; lớp và trường không bắt buộc. Website chỉ lưu một visitor ID kỹ thuật theo từng danh tính trên trình duyệt, không lưu dai dẳng tên/lớp/trường trong localStorage.

## Cải tiến v5.8.5

- Khóa vai rõ ràng: người học là Trưng Trắc; AI là cố vấn hội đồng nghĩa quân, không được tự nhận là Trưng Trắc hoặc viết thay lời người học. Backend tự kiểm tra và yêu cầu AI tạo lại JSON nếu phát hiện đảo vai.
- Phiếu nhập vai được dựng từ toàn bộ lịch sử tối đa 6 lượt bằng bố cục PDF riêng. Không còn nhân bản panel `position: fixed` ra ngoài màn hình, là nguyên nhân tạo trang trắng.
- Phiếu PDF có tên/lớp/trường, quyết định từng lượt, phản hồi, chỉ số định tính, nguồn bối cảnh và tổng kết; không chứa session ID/UUID kỹ thuật.
- `html2pdf.js` được phục vụ từ project, có file giấy phép đi kèm.
- Tốc độ đọc câu trả lời AI tăng nhẹ từ 1.08× lên 1.12×. VI vẫn chỉ dùng giọng Việt; EN chỉ dùng giọng Anh.
- Chuẩn hóa các trường AI cho Tra cứu/Giả định/Nhập vai, ẩn nhãn kỹ thuật, loại lựa chọn trùng, ép đúng 3 lựa chọn và giới hạn mỗi chỉ số chỉ đổi tối đa một mức giữa hai lượt.

## Kiểm tra PDF

Sau khi hoàn tất đủ lượt nhập vai, bấm `Xuất phiếu học tập`. Nút sẽ hiện trạng thái `Đang tạo PDF…`, tự khóa để tránh xuất lặp, rồi báo thành công hoặc lỗi. Kiểm tra file tải về có đủ các lượt và không bị trắng/cắt lề.
