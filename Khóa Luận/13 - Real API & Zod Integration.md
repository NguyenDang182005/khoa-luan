# 🔄 Real API Integration & Xoá Hardcode — Sprint 3

> Hoàn thành: **2026-09-09** | Build: API ✅ 0 errors | Web ✅ 0 TS errors
> Thực hiện bởi AI Agent (Antigravity)

---

## 🎯 Mục Tiêu
Xóa toàn bộ giá trị hardcode trong 8 view components và thay thế bằng:
- Real API calls đến NestJS backend
- Zod schema validation
- Axios client tập trung
- Endpoint slug (`/employees/by-code/:code`)
- Agent performance metrics thật từ DB

---

## 🗄️ Database Migration (20260909000002)

- **Thêm enum** `AttendanceDayType`: `NORMAL | WEEKEND | HOLIDAY`
- **Thêm field** `dayType AttendanceDayType` vào bảng `attendances`
- **3 models Training mới:**
  - `TrainingQuestion` — câu hỏi quiz + tự luận theo scenario
  - `TrainingSession` — phiên thi của nhân viên + điểm AI
  - `TrainingAttempt` — câu trả lời từng câu
- **3 enums mới:** `AttendanceDayType`, `TrainingScenario` (6 kịch bản), `TrainingAttemptStatus`

---

## 🖥️ Backend — 3 Modules Mới

### DashboardModule (5 endpoints)
- `GET /api/v1/dashboard/kpis` — Tổng nhân sự, chấm công, quỹ lương, AI rate
- `GET /api/v1/dashboard/attendance-chart` — Biểu đồ theo ngày (DB thật)
- `GET /api/v1/dashboard/department-distribution` — Phân bổ nhân sự
- `GET /api/v1/dashboard/pending-leaves` — Đơn nghỉ chờ duyệt
- `GET /api/v1/dashboard/ai-activity` — Log AI agents

### AgentsModule (1 endpoint)
- `GET /api/v1/agents/performance` — `avgLatency`, `callCount`, `successRate` cho wf01–wf04
- Đọc từ `AiChatMessage.metadata.latency_ms` — **n8n phải save field này!**

### TrainingModule (6 endpoints)
- `GET /api/v1/training/questions` — Câu hỏi theo scenario
- `GET /api/v1/training/my-sessions` — Lịch sử bài test của nhân viên
- `POST /api/v1/training/sessions` — Bắt đầu phiên
- `POST /api/v1/training/sessions/:id/attempts` — Nộp câu trả lời
- `PATCH /api/v1/training/sessions/:id/grade` — Lưu kết quả AI từ WF03
- `GET /api/v1/training/analytics` — Tổng hợp Radar + bảng xếp hạng (Admin)

### Endpoints Mở Rộng
- `GET /api/v1/employees/by-code/:code` — **Slug endpoint** (EMP001, EMP002...)
- `GET /api/v1/n8n/escalation-queue` — Ca đang escalate từ Zalo CSKH

### Fix OT Calculation
- **Trước:** dùng `overtimeRate` (1.5x) cho tất cả OT
- **Sau:** GroupBy `dayType` → `NORMAL`×1.5 / `WEEKEND`×2.0 / `HOLIDAY`×3.0

---

## 🌐 Frontend — API Layer Mới

### Axios Client (`lib/api/client.ts`)
- Auto-attach JWT Bearer token từ `localStorage`
- 401 interceptor → clear + redirect
- Timeout 15s

### 6 Zod Schemas (`lib/schemas/`)
| Schema | Validate |
|---|---|
| `dashboard.schema.ts` | KPI, chart, leaves, activity |
| `employee.schema.ts` | Employee, EmployeeList, Department |
| `payroll.schema.ts` | PayrollRecord, SalaryConfig |
| `leave.schema.ts` | LeaveRequest, LeaveBalance, **LeaveCreate** (validation rules) |
| `agent.schema.ts` | AgentPerf, AllAgentsPerf |
| `training.schema.ts` | TrainingSession, AiScore, Analytics |

### 7 API Client Files (`lib/api/`)
`dashboard.api.ts` | `employees.api.ts` | `payroll.api.ts` | `leave.api.ts` | `agents.api.ts` | `training.api.ts` | `escalation.api.ts`

---

## 📋 Views — Tóm Tắt Refactor

| View | Hardcode đã xóa | Thay bằng |
|---|---|---|
| `dashboard-view` | 5 mock constants + 12 KPI cứng | 5 API calls + skeleton loading |
| `employees-view` | `mockEmployees` + `departments` cứng | Paginated API + dept dropdown thật |
| `payroll-view` | `initialPayroll` + setTimeout fake | `generateBulk()` + `approve()` thật |
| `employee-portal-view` | Profile EMP003 cứng + Math.random() chat | `useAuth()` + leaveApi + payrollApi + n8n chat thật |
| `ai-agents-view` | `agentMetrics` cứng + setTimeout AI fake | `agentsApi.getPerformance()` refresh 30s + chat thật |
| `cskh-escalation-view` | `mockCases` + chatLog cứng | `escalationApi.getQueue()` poll 10s + history thật |
| `training-analytics-view` | `radarData` + `candidateResults` cứng | `trainingApi.getAnalytics()` |
| `my-training-view` | `MOCK_HISTORY` (comment "sẽ thay") | `trainingApi.getMySessions()` |

---

## ⚠️ Việc Cần Làm Tiếp

- [ ] Cập nhật n8n WF02/03/04: thêm `latency_ms` vào `AiChatMessage.metadata` khi save
- [ ] Test flow Training Module end-to-end (start session → submit → WF03 grade → my-training hiển thị)
- [ ] Seed thêm câu hỏi cho các scenario khác (COLLEAGUE_CONFLICT, MANAGER_FEEDBACK...)

---

*Cập nhật bởi AI Agent (Antigravity) — 2026-09-09 17:38 ICT*
*Liên kết: [[09 - Task Checklist]] | [[10 - Nhật Ký Tích Hợp]] | [[11 - Định Hướng Phát Triển (Web & Mobile)]]*