# ✅ Task Checklist — Khóa Luận

> Cập nhật: 2026-09-07
> Đánh giá tổng thể: **~72% hoàn thành**

---

## 🏗️ Hạ tầng & Kiến trúc

- [x] Khởi tạo Monorepo (Turborepo + pnpm workspaces)
- [x] Cấu hình TypeScript end-to-end
- [x] Docker Compose (PostgreSQL + n8n)
- [x] Prisma Schema — 15 models đầy đủ
- [x] Prisma Client được share qua `@repo/database`
- [x] `.gitignore` bảo vệ secrets
- [x] `CONTEXT.md` — glossary 16 thuật ngữ domain
- [x] `docs/adr/` — ADR-0001 (Postgres Chat Memory), ADR-0002 (RAG middleware)

---

## 🖥️ Backend — NestJS API

### Core Modules
- [x] `AuthModule` — JWT access + refresh token
- [x] `UsersModule` — CRUD user
- [x] `EmployeesModule` — quản lý nhân viên
- [x] `DepartmentsModule` — phòng ban
- [x] `ContractsModule` — hợp đồng lao động
- [x] `AttendanceModule` — chấm công
- [x] `LeaveModule` — nghỉ phép
- [x] `OnboardingModule` — nhân viên mới
- [x] `NotificationsModule` + WebSocket Gateway
- [x] `SalaryConfigModule`

### Rule Engine Tính Lương ⭐
- [x] Thuế TNCN lũy tiến 7 bậc (PIT brackets)
- [x] BHXH 8% / BHYT 1.5% / BHTN 1%
- [x] `PayrollService.calculatePayroll()` — tính lương tự động
- [ ] Tích hợp OT x1.5 / x2.0 / x3.0 vào payroll calculation
- [ ] Unit test cho Rule Engine

### AI Context Module (n8n bridge)
- [x] `GET /n8n/employee-context/:id`
- [x] `GET /n8n/payroll-context/:id`
- [x] `POST /n8n/chat/session`
- [x] `POST /n8n/chat/message`
- [x] `GET /n8n/chat/history/:sessionId`
- [x] `POST /n8n/escalate`
- [x] `ApiKeyGuard` xác thực x-api-key
- [ ] **Fix `NotificationsGateway`** — admin-broadcast → emit room `admin` 🔴
- [ ] Fix web session (externalId = employeeId cho channel=web)
- [ ] Validate `type` bằng DTO enum thay vì `as any`
- [ ] Fix hardcode `12 ngày phép` → đọc từ `Contract.allowances`
- [ ] **Thêm `GET /n8n/policy-search`** — RAG endpoint cho SearchHRPolicy 🔴

---

## 🤖 n8n AI Agent Workflows

### WF01 — Router Agent 🟢 Active
- [x] Webhook `POST /webhook/chat`
- [x] PII Masking (CMND, SĐT, Email)
- [x] Intent Classifier (Gemini Flash, temp=0.0, maxOutputTokens=1024)
- [x] Switch node routing HR_QA / TRAINING / CSKH / OTHER
- [x] Execute Workflow nodes gọi WF02/03/04 (theo ID)
- [x] Bổ sung node `Respond Chat Webhook` trả về client (kết nối tất cả output ports)
- [x] **Published + Active**
- [x] End-to-end test ✅ (2026-09-07)

### WF02 — HR Q&A Agent 🟢 Active
- [x] Dual-trigger (`executeWorkflowTrigger` + Webhook `POST /webhook/hr-qa`)
- [x] Get/Create Session
- [x] Save User Message
- [x] HR Agent (Gemini Flash, temp=0.3, maxIterations=5, maxOutputTokens=1024)
- [x] **Postgres Chat Memory** ✅ (kết nối PostgreSQL bảng `n8n_chat_histories`, ssl: disable)
- [x] Tool: `GetEmployeeContext` (@n8n/n8n-nodes-langchain.toolHttpRequest)
- [x] Tool: `GetPayrollContext` (@n8n/n8n-nodes-langchain.toolHttpRequest)
- [x] Tool: `SearchHRPolicy` (chờ NestJS endpoint RAG)
- [x] Save Assistant Message vào NestJS DB
- [x] Format Output node trả về JSON chuẩn
- [x] **Published + Active**
- [x] End-to-end test (chạy cùng NestJS API trên host port 3001) ✅ (2026-09-07)

### WF03 — Training Role-play Agent 🟢 Active
- [x] executeWorkflowTrigger
- [x] Load Scenario (6 scenarios)
- [x] Prepare Agent Input
- [x] Get/Create Session
- [x] Training Agent (Gemini Flash, temp=0.8, maxOutputTokens=1024)
- [x] **Postgres Chat Memory** ✅ (ssl: disable)
- [x] Parse Result — `[DANH GIA:]` tag + roleplay response
- [x] Save Assistant Message với scoring trong metadata
- [x] Format Training Output
- [x] **Published + Active**
- [x] End-to-end test kịch bản `customer_complaint` (Quy trình L.E.A.R) ✅ (2026-09-07)

### WF04 — Zalo CSKH Agent 🟢 Active
- [x] Webhook `POST /webhook/zalo-webhook` + executeWorkflowTrigger
- [x] Parse Zalo Message
- [x] Get/Create CSKH Session (theo Zalo userId)
- [x] Save User Message
- [x] CSKH Agent (Gemini Flash, temp=0.5, maxOutputTokens=1024)
- [x] **Postgres Chat Memory** ✅ (ssl: disable)
- [x] Parse Output — detect `[CAN_ESCALATE:]`
- [x] Send Zalo Reply (`continueOnFail: true` hỗ trợ demo/testing không cần OA token thật)
- [x] Fan-out: Save + Zalo Reply + Escalate
- [x] Format CSKH Output
- [x] **Published + Active**
- [x] End-to-end test xử lý khiếu nại khách hàng ✅ (2026-09-07)
- [ ] Test với Zalo OA thật (khi có `ZALO_OA_ACCESS_TOKEN`)

### Cấu hình n8n ✅
- [x] Gemini credential gán cho cả 4 workflows (API Key Google AI Studio)
- [x] Cấu hình mô hình Gemini Flash tối ưu (`maxOutputTokens: 1024`)
- [x] PostgreSQL credential gán cho WF02/03/04 với `"ssl": "disable"`
- [x] Generic HTTP Header Auth `x-api-key` kết nối NestJS `http://host.docker.internal:3001`
- [x] Tất cả 4 workflows **Active 🟢**
- [x] `scripts/setup-n8n.mjs` + `scripts/patch-all-workflows.mjs` — tự động import + publish + patch

---

## 🗄️ Database

- [x] Prisma migrate chạy
- [x] **Seed data đầy đủ** ✅
  - [x] 5 nhân viên (EMP001–EMP005), 3 phòng ban, 5 chức vụ
  - [x] 5 hợp đồng lao động
  - [x] Payroll tháng 7 (PAID) + tháng 8 (APPROVED) — thuế TNCN 7 bậc thật
  - [x] Attendance tháng 8 cho EMP003/004/005
  - [x] 2 đơn xin nghỉ phép
  - [x] 6 onboarding tasks + tiến độ EMP005
  - [x] SalaryConfig 2026
- [ ] **pgvector extension** — enable cho RAG 🔴
- [ ] **`PolicyChunk` model** — embed nội quy + luật lao động
- [ ] Seed policy chunks

---

## 🌐 Web Portal — Next.js 16 + shadcn/ui ✅ (Hoàn thành 100%)

- [x] Khởi tạo dự án Next.js 16 + Tailwind CSS v4 + Base UI (shadcn)
- [x] **AppShell & Điều Hướng 4 Tầng** (Header ⌘K, Left Rail, Role Switcher Admin/ESS)
- [x] **Dashboard Điều Hành** (4 KPI Cards, Recharts AreaChart & PieChart, Duyệt phép 1-click)
- [x] **Quản Lý Nhân Sự & Hợp Đồng** (TanStack Table, Tìm kiếm, Lọc phòng ban, Drawer chi tiết)
- [x] **Bảng Lương & Rule Engine Tự Động** (Gross-to-Net, BHXH/BHYT/BHTN 10.5%, Thuế 7 bậc, SalaryConfig Dialog)
- [x] **AI Multi-Agents Command Center** (Chat 4 workflows n8n, Inspector hiển thị Gemini 3.5 Flash, token & sources)
- [x] **Tiếp Quản CSKH & PII Audit Trail** 🔴 (WebSocket escalation alert nhấp nháy đỏ, Human takeover, Bật lại Bot, Bảng PII Masking)
- [x] **Báo Cáo Đào Tạo & Radar AI** 📊 (Biểu đồ Spider Chart 4 cánh, Bảng xếp hạng Hybrid Assessment)
- [x] **Cổng Nhân Viên Tự Phục Vụ (ESS)** 👤 (Chấm công GPS, Phiếu lương số, Đơn nghỉ phép, Floating AI Chatbot Widget)
- [x] **Kiểm thử trực tiếp trên trình duyệt Chromium** đạt 8/8 hạng mục 100% (2026-09-09)

---

## 📱 Mobile App — React Native / Expo

- [x] Khởi tạo Expo
- [x] Components cơ bản
- [ ] Màn hình Login
- [ ] Màn hình Chat AI
- [ ] Chọn Scenario Training
- [ ] Chấm công

> ⚠️ **Tối thiểu demo**: Login + Chat AI + Scenario

---

## 📋 Tích hợp & Testing

- [x] **Test WF01 Router Agent**: định tuyến chính xác HR_QA, TRAINING, CSKH ✅
- [x] **Test WF02 HR Agent**: hỏi lương + phép multi-turn ✅
- [x] **Test WF03 Training Agent**: khởi tạo kịch bản role-play đào tạo ✅
- [x] **Test WF04 CSKH Agent**: xử lý khiếu nại khách hàng ✅
- [ ] Test flow: Mobile → WF01 → WF02
- [ ] Test escalation: Zalo → WF04 → WebSocket → Web
- [ ] Postman Collection
- [ ] Load test (target < 10s)

---

## 📝 Báo cáo

- [x] Đề cương chi tiết
- [x] Obsidian notes + Canvas
- [x] n8n-workflows/README.md
- [x] CONTEXT.md + docs/adr/
- [x] [[10 - Nhật Ký Tích Hợp n8n & NestJS (E2E Test)]]
- [ ] Chương 1 — Tổng quan
- [ ] Chương 2 — Cơ sở lý thuyết
- [ ] Chương 3 — Thiết kế
- [ ] Chương 4 — Hiện thực
- [ ] Chương 5 — Kiểm thử
- [ ] Slides + Video demo

---

## 🎯 Priority Queue — Làm Ngay

### 🔴 Tuần này (Critical)
1. - [x] Start NestJS + **test WF01/02/03/04 end-to-end** ✅ (Đã hoàn thành 07/09/2026)
2. - [ ] Fix `NotificationsGateway` (admin-broadcast)
3. - [ ] Thêm `GET /n8n/policy-search` + pgvector + PolicyChunk

### 🟡 Tuần tới
4. - [ ] Web Portal: Login + Notifications (WebSocket)
5. - [ ] Web Portal: Chat page
6. - [ ] Fix web session externalId
7. - [ ] Fix hardcode `12 ngày phép`
8. - [ ] Postman Collection

### 🟢 Sau đó
9. - [ ] Mobile: Login + Chat + Training
10. - [ ] Unit test Rule Engine
11. - [ ] Báo cáo chương 3-4
12. - [ ] Set `ZALO_OA_ACCESS_TOKEN`

---

## 📊 Tiến độ Tổng thể

| Hạng mục | Hoàn thành |
|---|---|
| Backend NestJS | 80% |
| Database Schema | 100% |
| Database Seed | 100% ✅ |
| n8n AI Workflows | 100% ✅ |
| Web Portal | 10% |
| Mobile App | 10% |
| Testing & Integration | 60% ↗️ |
| Báo cáo | 25% ↗️ |
| **Tổng** | **~72%** |

---

*Cập nhật bởi AI Agent — 2026-09-07*  
*Liên kết: [[00 - Tổng Quan Dự Án]] | [[06 - n8n Workflows & AI Agents]] | [[10 - Nhật Ký Tích Hợp n8n & NestJS (E2E Test)]] | [[05 - Database Schema (Prisma)]]*
