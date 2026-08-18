# WEBSITE LỊCH SỬ TƯƠNG TÁC — TRƯNG TRẮC

Bản FULL gồm frontend, backend Express, dữ liệu song ngữ, mô hình 3D, audio thuyết minh VI/EN, OpenAI TTS, PDF và cấu hình Vercel. Website không gửi hoặc lưu dữ liệu hoạt động ra dịch vụ bảng tính bên ngoài.

## File chính

- `server.js` — các endpoint `/health`, `/ask`, `/whatif`, `/roleplay`, `/speak`.
- `public/index.html`, `public/styles.css`, `public/app.js` — giao diện và hành vi tương tác.
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

## Nhập vai quyết sách

- Khi chưa có tình huống, nút hiển thị `Bắt đầu tình huống`.
- Khi tình huống đã được tạo, nút đổi thành `Bắt đầu tình huống mới`.
- Bấm nút này sẽ hủy yêu cầu/audio AI đang chạy, xóa lịch sử lượt cũ, lựa chọn, nhận xét, kết quả và chỉ số mô phỏng, đưa lượt về 1 rồi tạo tình huống mới.
- Chỉ số mô phỏng hiển thị bằng mức định tính, không phải dữ kiện lịch sử. Baseline lượt đầu: Quân sự Khá; Ngoại giao Trung bình; Lòng dân Tốt; Hậu cần Trung bình; Chính trị Khá; Quản trị Trung bình.

## Nguyên tắc nội dung

AI chỉ nhận bộ facts trong `trung-trac.json`. Khi dữ liệu không đủ, câu trả lời tiếng Việt phải ghi “Chưa đủ nguồn để khẳng định.” Các điểm về tên chồng, niên đại cuối đời và cách kể cái chết được đánh dấu là tranh luận/truyền thống thay vì khẳng định tuyệt đối.
