# WEBSITE LỊCH SỬ TƯƠNG TÁC — TRƯNG TRẮC

Bản FULL gồm frontend, backend Express, dữ liệu song ngữ, mô hình 3D, audio thuyết minh VI/EN, OpenAI TTS, PDF, Google Sheets và cấu hình Vercel.

## File chính

- `server.js` — các endpoint `/health`, `/ask`, `/whatif`, `/roleplay`, `/speak`, `/save-report`.
- `public/index.html`, `public/styles.css`, `public/app.js` — giao diện và hành vi tương tác.
- `public/data/trung-trac.json` — hồ sơ song ngữ, timeline, facts có `sourceId`, nguồn, gợi ý và kịch bản nhập vai.
- `public/assets/trung_trac.glb` — mô hình 3D.
- `public/assets/trung_trac_tieng_viet.mp3`, `public/assets/trung_trac_tieng_anh.mp3` — audio thuyết minh.
- `google-apps-script.gs` — ghi tương tác và tổng kết phiên vào Google Sheets; không tự xóa dữ liệu cũ.
- `.env.example` — tên biến môi trường, không chứa khóa thật.
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
# Điền OPENAI_API_KEY và GOOGLE_SHEET_URL vào .env
npm start
```

Mở `http://localhost:3000`; kiểm tra `http://localhost:3000/health`.

## Google Sheets

1. Tạo Google Sheet mới hoặc dùng Sheet hiện có.
2. Mở **Extensions → Apps Script**, dán nội dung `google-apps-script.gs`.
3. Deploy thành **Web app**, quyền chạy bằng tài khoản chủ sở hữu và cho phép người dùng phù hợp truy cập.
4. Đặt URL deployment vào biến môi trường `GOOGLE_SHEET_URL`.
5. Hàm `autoDeleteOldData()` đã bị vô hiệu hóa; dữ liệu nghiên cứu cũ không bị tự xóa.

## Upload GitHub và deploy Vercel

1. Giải nén ZIP, tạo repository GitHub và upload toàn bộ nội dung ở thư mục gốc.
2. Import repository vào Vercel.
3. Thêm Environment Variables: `OPENAI_API_KEY`, `OPENAI_TEXT_MODEL`, `OPENAI_TTS_MODEL`, `GOOGLE_SHEET_URL`.
4. Deploy, sau đó mở `/health`; `ok` phải là `true` và `aiReady` là `true` khi đã cấu hình API key.

`API_BASE_URL` mặc định để trống vì frontend và backend chạy cùng domain. Không đưa file `.env` hoặc API key thật lên GitHub.

## Nguyên tắc nội dung

AI chỉ nhận bộ facts trong `trung-trac.json`. Khi dữ liệu không đủ, câu trả lời tiếng Việt phải ghi “Chưa đủ nguồn để khẳng định.” Các điểm về tên chồng, niên đại cuối đời và cách kể cái chết được đánh dấu là tranh luận/truyền thống thay vì khẳng định tuyệt đối.
