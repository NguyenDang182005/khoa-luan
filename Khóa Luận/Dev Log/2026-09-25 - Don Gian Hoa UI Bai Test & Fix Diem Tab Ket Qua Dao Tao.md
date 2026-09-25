# Đơn Giản Hóa UI Bài Test & Fix Điểm Sai Tab Kết Quả Đào Tạo

**Ngày:** 2026-09-25  
**Trạng thái:** ✅ Hoàn thành — UI đơn giản hóa, bug điểm đã fix, 21/21 test pass, dữ liệu lịch sử đã sửa lại

---

## 1. Đơn giản hóa UI form bài test (QuizCard — WF03)

**Vấn đề:** Form bài test (5 trắc nghiệm + 2 tự luận) trong tab AI Agents → Đào tạo đang quá "màu mè": viền amber, badge amber, hover amber, khung kết quả teal, emoji 🎓.

**File:** `apps/web/components/views/ai-agents-view.tsx` (component `QuizCard`)

### Thay đổi

| Thành phần | Trước | Sau |
|------------|-------|-----|
| Khung card | viền `agent-amber/30`, `bg-card/80`, shadow | viền `border-border`, `bg-card` phẳng |
| Header | icon amber + Badge amber "5 trắc nghiệm • 2 tự luận" | icon muted + chữ muted giản dị |
| Option được chọn | nền/viền amber, chữ amber | viền `foreground/60` + nền `muted` (nhấn bằng độ tương phản) |
| Hover option | đổi viền + nền amber | nền `muted/60` |
| Textarea tự luận | focus viền amber | focus ring chuẩn theme (`ring-ring`) |
| Khung kết quả | nền teal + emoji 🎓 + chữ bold | nền `muted/40` giản dị |
| Điểm AI essay | chữ amber | chữ thường, medium |

**Giữ lại (có mục đích chức năng):** ✓ xanh / ✗ đỏ nhạt khi chấm — phản hồi đúng/sai, giảm độ đậm từ `/10` xuống `/5`. Nút "Nộp bài" dùng primary chuẩn.

---

## 2. Bug tab "Kết Quả Đào Tạo" hiển thị sai điểm

### 2.1. Triệu chứng (reproduce trên UI thật)

Đăng nhập `employee1@company.com` (EMP005 — Phạm Văn Chinh), mở tab Kết Quả Đào Tạo:

- Session mới nhất (Xung đột đồng nghiệp 25/09): **Quiz 10/50 • Tổng 10/100** — SAI
- Ground truth trong DB `training_attempts`: **2/5 MCQ đúng = 40%** → phải là Quiz 20/50 • Tổng 20/100
- Session 21/09: **0/100** dù học viên trả lời đủ 7 câu — SAI (MCQ không được chấm, `isCorrect` toàn NULL)

### 2.2. Nguyên nhân gốc

Chuỗi chấm điểm tin **counter aggregate do Gemini tự đếm** trong WF03:

1. `submitQuiz` (NestJS) forward answers (kèm `correctAnswer` của MCQ) → WF03 (n8n)
2. Prompt WF03 yêu cầu Gemini trả JSON: `{ score_percent, correct_count, total_mcq, results[], overall_feedback }`
3. **Gemini đếm sai aggregate**: trả `correct_count=1` trong khi chính `results[]` của nó đánh dấu 2 câu đúng
4. `training.service.ts` lấy `correct_count` làm chuẩn → `quizScore = 1/5 = 20%` (sai), `totalScore = 10`

Bug phụ: khi Gemini trả thiếu/không có `results[]` (lỗi 21/09), MCQ không được chấm — `isCorrect = null` dù đáp án + đáp án đúng có sẵn trong payload → quiz = 0 điểm oan.

**Đã loại trừ:** API `GET /training/my-sessions` trả đúng row/số liệu khớp DB (script kiểm chứng ALL GREEN); frontend truyền đúng `employeeId` (từ `/auth/profile` → `employee.id`); Zod parse không mất dữ liệu.

### 2.3. Fix — chấm MCQ deterministic phía server

**File:** `apps/api/src/training/training.service.ts` (hàm `submitQuiz`)

Nguyên tắc: đáp án + đáp án đúng **đã có sẵn trong payload** — không cần LLM cho phần trắc nghiệm.

```
Thứ tự ưu tiên correctCount:
1. So sánh trực tiếp answer vs correctAnswer (deterministic, trim + uppercase)
2. Fallback: đếm results[].correct === true (kết quả từng câu của WF03)
3. Cuối cùng mới dùng counter aggregate của LLM (legacy)

totalMcq = số câu MCQ thực tế trong answers (không tin LLM)
score_percent = Math.round(totalScore) tính local → chat và tab luôn khớp
isCorrect attempt = cùng hàm chấm → không còn NULL oan
```

### 2.4. Regression test

**File:** `apps/api/src/training/training.service.spec.ts` — 3 test, mock Prisma + fetch WF03:

| Test | Kịch bản | Kỳ vọng |
|------|----------|----------|
| Aggregate LLM sai | WF03 trả `correct_count=1` nhưng `results[]` có 2 câu đúng | `quizScore=40`, `totalScore=20`, attempts `[T,F,F,T,F]` |
| WF03 khuyết results | `results: []`, `correct_count: 0` | Vẫn chấm đúng 5/5 từ `correctAnswer`, attempts không NULL |
| Client không gửi correctAnswer | fallback theo `results[]` từng câu | Đếm 3/5 theo results, không phải 1 theo counter |

Kết quả: **đỏ trước khi fix (đúng như bug), xanh sau khi fix**. Full suite API: **21/21 pass**, `tsc --noEmit` sạch.

---

## 3. Sửa dữ liệu lịch sử

**File:** `packages/database/prisma/repair-training-scores.ts` (one-off, idempotent)

Logic: tính lại từ `training_attempts` (ground truth):
1. Chấm lại `isCorrect` MCQ = so `answer` vs `aiEvaluation.correct_answer`
2. `quizScore = mcq đúng / tổng mcq × 100`
3. `essayAvg` = TB score tự luận thật, fallback `aiScore.essay_avg`
4. `totalScore = round(quizScore×0.5 + essayAvg×10×0.5, 1)`

**Guard quan trọng (bài học):** session legacy từ seed có `aiEvaluation` định dạng cũ (không có field `type`) → **SKIP**, không đụng vào. Bản chạy đầu thiếu guard này làm sai 7 session seed (totalScore 91→50, aiScore 4 tiêu chí bị ghi đè) — đã khôi phục đúng công thức seed (`totalScore = round(quiz×0.4 + avg(ai)×0.6)`, `aiScore` giữ 4 tiêu chí riêng 0–100).

### Kết quả sửa dữ liệu (13 sessions)

| Session | Trước | Sau | Ghi chú |
|---------|-------|-----|---------|
| EMP005 · COLLEAGUE_CONFLICT 25/09 | quiz 20, total 10 | **quiz 40, total 20** | Gemini đếm sai 1/5 |
| EMP005 · CUSTOMER_COMPLAINT 21/09 | quiz 0, total 0 | **quiz 100, total 50** | MCQ từng bị bỏ chấm |
| EMP006 · COLLEAGUE_CONFLICT 24/09 | quiz 0, total 0 | **quiz 60, total 30** | tương tự |
| 4 session quiz-flow khác | — | giữ nguyên/đúng | idempotent |
| 7 session seed legacy 15/09 | — | giữ nguyên (SKIP) | định dạng cũ |

---

## 4. Verification end-to-end

| Loop | Kết quả |
|------|---------|
| `node scripts/diag-browser/debug-training-api.mjs` — API vs DB (3 employees) | ✅ ALL GREEN |
| `node scripts/diag-browser/debug-training-tab-ui.cjs` — puppeteer đăng nhập employee1, đọc tab thật | ✅ GREEN: Quiz 20/50 • Tổng 20/100 |
| `pnpm exec jest` (apps/api) | ✅ 21/21 pass |
| `pnpm exec tsc --noEmit` (api + web) | ✅ sạch |

---

## 5. Điểm còn tồn tại (cần quyết định sản phẩm)

1. **Radar 4 tiêu chí với bài test WF03:** pipeline chưa sinh điểm riêng từng tiêu chí → `aiScore` 4 trường đều = `essay_avg` → radar hình thoi đều. Muốn đúng cần WF03 chấm theo tiêu chí hoặc bỏ radar cho dạng session này.
2. **Lệch thang điểm cũ/mới:** seed legacy lưu tiêu chí thang 0–100, UI render `/10` (hàng 15/09 hiện "81.3/10"). Cần migrate legacy aiScore về 0–10 hoặc scale theo nguồn dữ liệu.

---

## 6. File thay đổi / thêm mới

| File | Loại |
|------|------|
| `apps/web/components/views/ai-agents-view.tsx` | sửa — đơn giản hóa QuizCard |
| `apps/api/src/training/training.service.ts` | sửa — chấm MCQ deterministic |
| `apps/api/src/training/training.service.spec.ts` | mới — 3 regression test |
| `packages/database/prisma/repair-training-scores.ts` | mới — sửa dữ liệu lịch sử |
| `scripts/diag-browser/debug-training-api.mjs` | mới — loop kiểm chứng API vs DB |
| `scripts/diag-browser/debug-training-tab-ui.cjs` | mới — loop kiểm chứng UI thật |

---

## 7. Trạng thái server

- **API** `localhost:3001` — ✅ Running (nest start --watch, tự nạp code mới)
- **Web** `localhost:3000` — ✅ Running
- **n8n** `localhost:5678` — ✅
- **PostgreSQL** `localhost:5432` — ✅ (dữ liệu training đã sửa lại)
