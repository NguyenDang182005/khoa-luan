---
tags: [khoa-luan, audit, training, scoring, hybrid-assessment]
created: 2026-09-25
---

# 🔍 Audit Cơ Chế Chấm Điểm AI (Hybrid Assessment)

> **Kiểm toán 25/09/2026** — rà 3 tầng chấm điểm (n8n WF03 → NestJS → Web), chạy regression test + E2E thật qua Gemini. Kết quả: **28/28 unit tests pass**, E2E live xác nhận fix hoạt động.

## 1. Kiến trúc thực tế — 2 luồng chấm điểm

| | **Luồng A — Quiz** (`POST /training/submit`) | **Luồng B — Role-play chat** (WF03) |
|---|---|---|
| Đường đi | AI Sandbox → NestJS → WF03 `/training-quiz` → Gemini chấm → **NestJS chấm lại MCQ deterministic** → lưu `TrainingSession` | Gemini trả kèm `[DANH GIA: chuyen_nghiep=.. dong_cam=.. giai_quyet=.. ro_rang=..]` → regex parse (`Parse Result` node) |
| Điểm 4 tiêu chí | Từ 25/09: **4 giá trị thật** (trước đó = essay_avg nhân bản ×4) | 4 giá trị thật (có sẵn) |
| Nơi lưu | `TrainingSession.aiScore` | `AiChatMessage.metadata.grade` |

## 2. Những gì làm ĐÚNG

1. **MCQ deterministic phía server** (`training.service.ts`) — so `answer` vs `correctAnswer` (trim + uppercase), không tin counter LLM. Nguyên nhân bug cũ: LLM tự đếm `correct_count` lệch với `results[]` (2/5 đúng nhưng lưu 20%).
2. **Công thức nhất quán 0–100**: `totalScore = quizScore×0.5 + essay_avg×10×0.5`, làm tròn 1 chữ số; `score_percent` chat tính local từ dữ liệu đã lưu → badge chat & tab kết quả không bao giờ lệch.
3. **Robustness nhiều lớp**: timeout 60s + `AbortSignal`, `x-api-key`, parser WF03 strip \`\`\`json fences + quiz dự phòng cứng khi LLM fail, fallback offline khi WF03 chết (MCQ vẫn chấm thật, essay = 6 trung lập).
4. **Regression spec đúng chất**: 3 test case — LLM đếm aggregate sai / `results[]` rỗng / client không gửi đáp án. **28/28 tests pass (25/09).**

## 3. Phát hiện & xử lý

### 🔴 R1 — Radar "4 tiêu chí" = essay_avg nhân bản ×4 → **ĐÃ FIX 25/09**
- **Trước:** `aiScore = {professional: essayAvg, empathy: essayAvg, problemSolving: essayAvg, clarity: essayAvg}` → Radar luôn hình thoi hoàn hảo, Killer #3 chỉ đúng narrative không đúng dữ liệu.
- **Fix:** (1) WF03 grade prompt yêu cầu mỗi essay trả `criteria{chuyen_nghiep, dong_cam, giai_quyet, ro_rang}` 0–10; (2) `submitQuiz` trung bình theo tiêu chí, fallback `essay_avg` khi LLM không trả criteria.
- **E2E chứng minh (live Gemini):** essay #7 chấm phân hóa `9/8/8/9`; MCQ 4/5 đúng khớp payload; `score_percent` tính đúng.

### 🟡 R2 — `essay_avg` không được prompt yêu cầu → chấp nhận, đã có fallback
Parser WF03 đọc `fgo.essay_avg` nhưng prompt không yêu cầu → luôn undefined; NestJS tự tính từ `results[]`. Nếu LLM bỏ essay results → essayAvg = 0 kéo total xuống thầm lặng. *Đánh giá: rủi ro thấp sau fix R1 (criteria là nguồn chính), không sửa thêm.*

### 🟡 R3 — Đáp án MCQ nằm trong payload trình duyệt → chấp nhận có chủ đích
Client nhận quiz kèm `correct` rồi echo `correctAnswer` khi nộp — đây là điều kiện để chấm deterministic. Trade-off hợp lý cho demo; **ghi vào báo cáo** là giới hạn anti-cheat, hướng phát triển: che đáp án server-side.

### 🟡 R4 — `gradeSession` legacy skew → ghi nhận, chưa sửa
`Object.values(aiScore)` tính trung bình trên mọi key (nếu có `essay_avg` thì bị lệch). Endpoint không còn ai gọi; đề xuất: xóa hoặc bỏ trong báo cáo như "legacy surface".

### 🔵 R5 — Fallback essay = 6 cứng → đúng thiết kế
Graceful degradation khi WF03 chết. Báo cáo phải ghi rõ đây là "chế độ offline", không phải "AI chấm".

## 4. Bằng chứng kiểm thử (25/09)

- **Unit:** `pnpm --filter api test` → 3 suites, **28/28 pass** (gồm 3 test hồi quy chấm MCQ).
- **E2E live:** `POST /webhook/training-quiz` (7 câu: 5 MCQ + 2 essay dài) qua Gemini:
  - `correct_count: 4/5` (khớp payload — câu 2 cố tình sai)
  - essay #6: `score=9`, criteria `9/9/9/9`; essay #7: `score=8.5`, criteria `9/8/8/9` ← **phân hóa thật**
  - `overall_feedback` tiếng Việt đúng ngữ cảnh
- **Workflow live:** PUT chỉ WF03 (id `aaCU1Zr00f506dcJ`) → `active: true`, không đụng WF01/02/04.

## 5. Việc đã làm trong đợt audit này

- [x] Sửa `n8n-workflows/03-training-agent.json` (2 bản sao node grade prompt — thêm yêu cầu criteria)
- [x] Sửa `apps/api/src/training/training.service.ts` — `critAvg()` + `criteriaScore` với fallback an toàn
- [x] Re-run unit tests: 28/28 pass
- [x] Push WF03 lên n8n live (script one-off, đã dọn) + activate
- [x] E2E probe live Gemini — criteria xuất hiện, phân hóa đúng

## 6. Ghi chú phụ phát hiện trong lúc audit

- `scripts/setup-n8n.mjs` chứa **fallback hardcode** `N8N_API_KEY` + `GEMINI_API_KEY` trong source — mâu thuẫn với cam kết "secrets chỉ nằm ở .env" (doc 00/README). Đề xuất: chuyển sang chỉ đọc `process.env`, fail nhanh khi thiếu.

---

*Liên kết: [[09 - Task Checklist]] | [[11 - Định Hướng Phát Triển Sản Phẩm (Web & Mobile)]] | [[14 - Training Quiz & Dashboard]] | [[23 - Quyết Định Web-Only Phase 1 (Cắt Mobile App)]]*
