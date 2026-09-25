# Fix Endpoint Test Suite & WF03 Quick Action Buttons

**Ngày:** 2026-09-23  
**Trạng thái:** ✅ Hoàn thành — 57/57 test pass (100%)

---

## 1. Kết quả kiểm thử toàn bộ endpoint

Script: `scripts/test-all-endpoints.mjs`

| Section | Test | Kết quả |
|---------|------|---------|
| Auth & Phân quyền | 5 | ✅ |
| Employees (RBAC) | 4 | ✅ |
| Payroll & Salary | 4 | ✅ |
| Leave | 6 | ✅ |
| Settings (7 section) | 15 | ✅ |
| Agents / Chat Portal | 10 | ✅ |
| Onboarding, Notif, Training | 6 | ✅ |
| Dashboard KPIs | 3 | ✅ |
| n8n WF01–WF04 (direct webhook) | 4 | ✅ |
| **Tổng** | **57** | **100%** |

---

## 2. Các bug đã phát hiện và fix

### Bug 1 — EMPLOYEE có thể xem `/employees` list (thiếu RBAC)

**File:** `apps/api/src/employees/employees.controller.ts`  
**Fix:** Thêm `@UseGuards(RolesGuard) @Roles('ADMIN')` cho `GET /`

```typescript
@Get()
@UseGuards(RolesGuard)
@Roles('ADMIN')
@ApiOperation({ summary: 'Danh sách nhân viên (chỉ ADMIN)' })
findAll(...) { ... }
```

---

### Bug 2 — WF03 generate_quiz trả về DB record thay vì `questions[]`

**Nguyên nhân:**
- Connection `Save Quiz Assistant Message → (main: [])` — dead end
- `Format Training Output` đọc `$input` (DB record) thay vì dữ liệu quiz

**Fix:** 2 bước:

**Bước 1 — Fix connections trong n8n WF03:**
```json
"Save Quiz Assistant Message": {
  "main": [[{"node": "Format Training Output", "type": "main", "index": 0}]]
},
"Save Grade Assistant Message": {
  "main": [[{"node": "Format Training Output", "type": "main", "index": 0}]]
}
```

**Bước 2 — Fix `Format Training Output` jsCode** để detect branch:
```js
// Quiz branch: read questions từ Format Quiz Output
try {
  const fqo = $("Format Quiz Output").first().json;
  if (fqo && Array.isArray(fqo.questions)) {
    return [{ json: { questions: fqo.questions, answer: fqo.answer, ... } }];
  }
} catch(_) {}
// Grade branch, Roleplay branch tương tự...
```

**Script fix:** `scripts/fix-wf03-final.cjs`

---

### Bug 3 — Quick Action Buttons WF03: intent/action sai

**File:** `apps/web/components/views/ai-agents-view.tsx`

| Nút | Message cũ | Vấn đề | Message mới |
|-----|-----------|--------|-------------|
| 🎯 Xử lý khiếu nại KH | "...xử lý **khiếu nại khách hàng**" | CSKH keyword overlap | "...xử lý **tình huống khiếu nại**" |
| 💬 Role-play giao tiếp | "**Bắt đầu đào tạo** role-play..." | "bắt đầu đào tạo" trigger generate_quiz SAI | "**Luyện tập tình huống** role-play..." |

---

### Bug 4 — Quick Action Buttons không truyền `scenarioType`

WF03 load đúng kịch bản theo `scenarioType`. Trước đây tất cả đều dùng `general_communication`.

**Fix — Chuỗi thay đổi (end-to-end):**

1. `agent-chat.dto.ts` — thêm field `scenarioType?: string`
2. `portal.controller.ts` — forward `dto.scenarioType`
3. `agents.service.ts` — nhận param + thêm vào body n8n
4. `agents.api.ts` (web) — `chat()` nhận `opts.scenarioType`
5. `ai-agents-view.tsx` — mỗi button có `scenarioType` riêng

**Mapping scenarioType:**

| Nút | scenarioType |
|-----|-------------|
| 🎯 Xử lý khiếu nại | `customer_complaint` |
| 🤝 Giải quyết mâu thuẫn | `colleague_conflict` |
| 📋 Tiếp nhận feedback | `manager_feedback` |
| 🌱 Onboarding | `new_employee_onboarding` |
| 📊 Đánh giá hiệu suất | `performance_review` |
| 💬 Role-play giao tiếp | `general_communication` |

---

## 3. Kiến trúc luồng WF03 sau fix

```
Browser → (click quick button)
  → agentsApi.chat(msg, { scenarioType: "customer_complaint" })
  → NestJS POST /agents/chat (JWT)
  → portalChat() → fetch n8n /webhook/chat { message, scenarioType }
  → WF01 Router: Parse Intent → intent=TRAINING, action=generate_quiz
  → executeWorkflow(WF03) { action, scenarioType }
  → WF03: Action Switch → generate_quiz branch
  → Quiz Generator Agent (Gemini) → Format Quiz Output { questions[] }
  → Save Quiz Assistant Message (DB)
  → Format Training Output { questions[], answer, scenarioType }
  → WF01 router-respond (firstIncomingItem)
  → NestJS trả { answer, questions[], scenarioType }
  → UI render form bài thi
```

---

## 4. Script mới

- `scripts/test-all-endpoints.mjs` — Test suite 57 cases, phủ toàn bộ hệ thống
- `scripts/fix-wf03-final.cjs` — Fix WF03 connections + jsCode, deploy lên n8n

---

## 5. Trạng thái server

- **API** `localhost:3001` — ✅ Running (NestJS, build mới)
- **Web** `localhost:3000` — ✅ Running (Next.js, build mới)
- **n8n** `localhost:5678` — ✅ WF01/02/03/04 đều active
- **PostgreSQL** `localhost:5432` — ✅
