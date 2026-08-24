# Analytics integration v5.8.5

Website Trưng Trắc gửi dữ liệu hoạt động tới website quản lý theo mô hình backend-to-backend.

Vercel Environment Variables:

```env
ANALYTICS_API_URL=https://quan-ly-s7j8.vercel.app
ANALYTICS_INGEST_KEY=<cùng key với website quản lý>
```

Không đưa `ANALYTICS_INGEST_KEY` vào frontend/GitHub.

Sự kiện chính: session_start/end, page_view, character_open, profile_open, timeline_view, narration_play/pause, ask_question, whatif_question, roleplay_start/new_scenario/choice/end, language_change, pdf_export.
