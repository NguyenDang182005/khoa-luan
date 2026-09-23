---
tags: [khoa-luan, training, quiz, dashboard, nestjs, n8n, gemini]
created: 2026-09-17
updated: 2026-09-17
---

# 📝 Training Quiz & Dashboard

## Tổng Quan

Tính năng đào tạo mở rộng WF03 với **5 câu trắc nghiệm + 2 câu tự luận** do Gemini tự sinh theo kịch bản, cùng hệ thống dashboard theo dõi kết quả đào tạo của nhân viên và toàn công ty.

**Triển khai:** 17/09/2026

---

## Thiết Kế Đã Thống Nhất (Grill Session)

| Quyết định | Chi tiết |
|---|---|
| Nội dung câu hỏi | Gemini tự sinh theo `scenarioType`, không seed cứng |
| Format response | 1 JSON toàn bộ 7 câu (`questions[]`) |
| Submit | Toàn bộ 1 lần, `action: 'submit_quiz'` kèm `answers[]` |
| Chấm điểm | Gemini (MCQ đối chiếu đáp án, tự luận 0-10) |
| Lưu DB | `TrainingSession` + `TrainingAttempt` |
| WF03 scope | Giữ role-play + thêm nhánh quiz theo `action` field |

---

## NestJS Training Module — Endpoints Mới

### `POST /api/v1/training/submit`

Nhận toàn bộ bài làm → gọi WF03 `/webhook/training-quiz` với `action: 'submit_quiz'` → lưu `TrainingSession` + `TrainingAttempt` vào DB.

**Request body:**
```json
{
  "scenarioType": "customer_complaint",
  "answers": [
    {"questionId": 1, "type": "mcq", "answer": "B", "correctAnswer": "B"},
    {"questionId": 6, "type": "essay", "answer": "Tôi sẽ lắng nghe..."}
  ]
}
```

**Fallback:** Nếu WF03 fail, NestJS tự tính MCQ điểm căn cứ `correctAnswer` có sẵn trong payload, essay mặc định 6/10.

### `GET /api/v1/training/dashboard/me`

Dashboard cá nhân — yêu cầu JWT.

```json
{
  "totalSessions": 3,
  "averageScore": 71.5,
  "byScenario": {
    "customer_complaint": {"count": 2, "avgScore": 68},
    "colleague_conflict": {"count": 1, "avgScore": 78}
  },
  "recentSessions": [
    {"id": "...", "scenario": "customer_complaint", "totalScore": 65, "completedAt": "..."}
  ]
}
```

### `GET /api/v1/training/dashboard/overview`

Dashboard toàn công ty — yêu cầu JWT + role `ADMIN_GROUP`.

```json
{
  "totalEmployees": 25,
  "completionRate": 0.68,
  "byDepartment": [
    {"department": "Sales", "avgScore": 74, "count": 8}
  ],
  "topPerformers": [...]
}
```

---

## WF03 — Luồng Generate Quiz

1. WF01 detect keyword quiz (`bài test`, `quiz`, `trắc nghiệm`...) → set `action='generate_quiz'`
2. WF01 gọi WF03 qua `executeWorkflow` với `action + scenarioType + maskedMessage`
3. WF03 `Action Switch` → nhánh `generate_quiz`
4. `Build Quiz Gen Prompt` (Code) xây dựng prompt tiếng Việt cho Gemini
5. `Quiz Generator Agent` (Gemini, maxIterations=1) sinh 7 câu JSON thuần
6. `Format Quiz Output` (Code + fallback 7 câu cứng nếu parse lỗi)
7. Response qua `lastNode`

**Output mẫu (customer_complaint):**
- Q1-5: MCQ với 4 chọn A/B/C/D + `correct` + `explanation`
- Q6: Essay “Mô tả từng bước xử lý khi khách hàng phản nàn đơn hàng đến muộn và sản phẩm bị hỏng”
- Q7: Essay “Nếu khách hàng vẫn không hài lòng sau khi bạn đề xuất giải pháp...”

---

## WF03 — Luồng Submit & Chấm Điểm

1. NestJS `POST /training/submit` → gọi `POST /webhook/training-quiz` với `action: 'submit_quiz'`
2. WF03 `Action Switch` → nhánh `submit_quiz`
3. `Build Quiz Grade Prompt` (Code) xây dựng prompt chấm điểm toàn bộ 7 câu
4. `Quiz Grader Agent` (Gemini, maxIterations=1) trả JSON kết quả
5. `Format Grade Output` (Code) parse kết quả
6. NestJS nhận và lưu `TrainingSession` + 7 `TrainingAttempt`

**Công thức điểm:**
- `quizScore` = (correct_mcq / 5) × 100
- `essayAvg` = trung bình điểm 2 câu tự luận (0-10)
- `totalScore` = quizScore × 0.5 + essayAvg × 10 × 0.5

---

## Database Schema (Sử dụng lại, Không cần Migration)

| Model | Mục đích |
|---|---|
| `TrainingSession` | Lưu mỗi lần làm bài: `employeeId`, `scenario`, `quizScore`, `aiScore` (JSON), `totalScore`, `aiFeedback` |
| `TrainingAttempt` | Lưu từng câu trả lời: `sessionId`, `questionId` (FK placeholder), `answer`, `isCorrect`, `aiEvaluation` (JSON) |
| `TrainingQuestion` | Bảng legacy, dùng làm FK placeholder (type='scenario', question='[AI-generated]') |

> [!NOTE]
> `ensurePlaceholderQuestion()` tự động tìm/tạo 1 `TrainingQuestion` placeholder cho FK constraint của `TrainingAttempt`.

---

## Kết Quả Kiểm Thử (17/09)

| Test | Kết quả | Chi tiết |
|---|---|---|
| WF03 `generate_quiz` (webhook trực tiếp) | ✅ Pass | 5 MCQ + 2 essay, tiếng Việt |
| WF03 `submit_quiz` (webhook trực tiếp) | ✅ Pass | score=3/5=60%, feedback/câu |
| WF03 role-play (qua WF01 chat) | ✅ Pass | 6s, AI vào vai khách hàng bức xúc |
| NestJS `GET /training/dashboard/me` | ✅ Pass | 401 (JWT guard ok) |
| NestJS `GET /training/dashboard/overview` | ✅ Pass | 401 (JWT + Admin guard ok) |
| NestJS `POST /training/submit` | ✅ Pass | 401 (JWT guard ok) |
| WF02 HR Q&A (qua WF01 chat) | ✅ Pass | 7.8s, trả lời chính sách nghỉ phép |

---

## Files Đã Thay Đổi

| File | Thay đổi |
|---|---|
| `apps/api/src/training/training.service.ts` | Thêm `submitQuiz()`, `getMyDashboard()`, `getOverviewDashboard()`, `ensurePlaceholderQuestion()`, `fallbackGrade()`, `resolveEmployeeByUserId()` |
| `apps/api/src/training/training.controller.ts` | Thêm `POST /submit`, `GET /dashboard/me`, `GET /dashboard/overview` (Admin guard) |
| `apps/api/src/training/training.module.ts` | Thêm `ConfigModule` import |
| `n8n-workflows/01-router-agent.json` | PII Masking: extract `action`. Parse Intent: thêm quiz keywords + tự set `action='generate_quiz'` |
| `n8n-workflows/03-training-agent.json` | Viết lại hoàn toàn: 19 nodes, 3 Gemini riêng biệt, webhook + quiz gen/grade branches |

---

## Bài Học Kỹ Thuật

- **1 Gemini LLM node → nhiều Agent** → `runData` rỗng, status `error` ngay lập tức. Phải tạo **3 node Gemini riêng biệt**.
- **`responseMode: 'responseNode'`** chỉ hoạt động khi path tới được `RespondToWebhook` node. Khi quiz path không tới được → body rỗng. Fix: dùng **`responseMode: 'lastNode'`**.
- **Quota Gemini free tier:** 15 RPM. Test nhiều lá vượt 429. Giải pháp: NestJS catch 429 → friendly message, chạy lại sau 60s.

---

*Liên kết:* [[06 - n8n Workflows & AI Agents]] | [[05 - Database Schema (Prisma)]] | [[09 - Task Checklist]]