# ✅ Task Checklist & Kế Hoạch Tính Năng Cần Phát Triển

> Cập nhật: **2026-09-15** | Đánh giá tổng thể: **~93% hoàn thành**
> Người cập nhật: AI Agent (Antigravity)

---

## 🚀 Cập Nhật 15/09 — Fix Bug & Real-time WebSocket (mới)

- [x] **Kiểm tra 37 endpoint** — audit toàn bộ port 3001, tìm ra 4 endpoint 500
- [x] **Fix NaN crash** khi thiếu `?month=&year=` trong 3 controller (`attendance`, `payroll`, `ai-context`)
- [x] **Redesign panel AI** — bỏ danh sách 10 message lặp → aggregate 3 workflow gọn (WF02/03/04)
- [x] **WebSocket real-time AI panel** — server push khi có message mới, 0 polling, badge live state
  - `NotificationsGateway.emitAiActivity()` → broadcast room `'admin'`
  - `AiContextService.saveMessage()` hook emit sau persist DB
  - `useAiSocket` hook (Next.js) — connect/reconnect, `join-admin`, listen `ai:activity`
  - Dashboard badge: xanh pulse = connected, xám = offline
- [x] Kết quả kiểm thử: badge WS xanh ✅, API aggregate 200 ✅, 0 TypeScript error ✅

---

## 🚀 Cập Nhật 14/09 — Mở Rộng Tính Năng & Dữ Liệu Demo (mới)

- [x] **Duyệt lương hàng loạt** — multi-select trên Bảng Lương; `POST /payroll/approve-bulk` & `paid-bulk`
- [x] **Hồ sơ nhân viên 5 nhóm** — drawer mới + `PATCH /employees/:id`
- [x] **Router card + thống kê intent** — `GET /agents/intent-stats`
- [x] **CSKH kênh Zalo — transport Slack** — WF04 + tab "Tất cả hội thoại"
- [x] **Trang Cài Đặt** (`settings-view`, chỉ HR_ADMIN/ADMIN)
- [x] **Seed demo đầy đủ** — 30 NV, 2.183 chấm công, 4 phiên AI
- [x] **Chạy thật luồng Slack CSKH end-to-end** — challenge echo + full AI pipeline ✓
- [x] **RAG kho tri thức chính sách** — `policy_chunks` + Gemini embedding + `KnowledgeModule` + WF02 tool

---

## 🔧 Cập Nhật 10/09 — Refactor Real API & Review Best Practice

- [x] **Xóa 100% mock Web Portal** — chạy dữ liệu thật
- [x] **Fix 2 bug runtime**: payroll `_breakdown` + escalate `admin-broadcast`
- [x] **Gỡ toàn bộ n8n key khỏi browser** — backend proxy JWT
- [x] **GPS Check-in/out thật** (Haversine, geofence)
- [x] **10 endpoint mới** agents/payroll/employees
- [x] **PII Audit Trail đọc từ DB** • Dashboard `activeWorkflows` đếm thật
- [x] Kiểm chứng: `api build` 0 lỗi • `web check-types` 0 lỗi

---

## 📊 Bảng Tiến Độ Tổng Thể

| Hạng mục | Trước | Hôm nay | Ghi chú |
|---|:---:|:---:|---|
| Backend NestJS | 97% | **98%** ✅ | +WS emit, fix NaN |
| Database Schema | 100% | **100%** ✅ | |
| Database Seed | 100% | **100%** ✅ | |
| n8n AI Workflows | 100% | **100%** ✅ | |
| Web Portal — UI | 100% | **100%** ✅ | Redesign AI panel |
| Web Portal — API | 100% | **100%** ✅ | |
| Firebase Auth | 90% | **90%** ✅ | |
| **Real-time WebSocket** | 50% | **90%** ✅ | Push-only AI panel + badge live |
| Mobile App | 10% | **10%** 🔴 | Ngoài scope |
| RAG / pgvector | 85% | **85%** ✅ | |
| Báo cáo luận văn | 30% | **30%** | |
| **Tổng** | **91%** | **93%** | **+2% đợt 15/09** |

---

## ❌ CHƯ A LÀM — Cần thực hiện

### 🔴 P0 — Critical

#### Mobile App — 0/8 màn hình (chưa bắt đầu)
- [ ] Expo Router setup
- [ ] Màn hình Login
- [ ] **Tab 1: Home + GPS Geofencing** 🌟 Killer Feature #1
- [ ] **Tab 2: Hybrid Assessment** 🌟 Killer Feature #3 Mobile
- [ ] Tab 3: AI Chat | Tab 4: Profile + Lương + Phép

#### Quick Fixes
- [ ] Fix `externalId = employeeId` cho session channel=web
- [ ] Seed 3 tài khoản OAuth thật

### 🟡 P1 — Important
- [ ] n8n WF02/03/04: thêm `latency_ms` vào metadata
- [ ] Seed câu hỏi Training 5 scenario còn lại
- [ ] ESS Onboarding View
- [ ] Test E2E Training Module
- [ ] Trang quản trị tài liệu RAG

### 🔵 P2 — Sprint 4
- [ ] Xuất Excel/PDF
- [ ] Unit test `PayrollService`
- [ ] Postman Collection + Load test
- [ ] Zalo OA thật

### 📝 Sprint 5 — Báo Cáo
- [ ] Chương 1–5 luận văn
- [ ] Slides thuyết trình
- [ ] Video demo 5 phút

---

## ✅ ĐÃ HOÀN THÀNH (tích lũy đến 15/09/2026)

### 🏗️ Hạ tầng
- [x] Monorepo Turborepo + pnpm + TypeScript + Docker + Prisma

### 🖥️ Backend NestJS (17+ modules)
- [x] Auth (JWT + Refresh + Firebase) | RolesGuard | HR_ADMIN role
- [x] Employees | Departments | Contracts | Attendance | Leave | Payroll
- [x] SalaryConfig | Onboarding | Notifications + WebSocket
- [x] AI Context Bridge | Dashboard | Agents | Training | Knowledge (RAG)
- [x] **Fix NaN crash** 3 controller (15/09)
- [x] **WebSocket emit trong `saveMessage()`** (15/09)

### 🗄️ Database
- [x] 15 models + 14 enums | Seed 30 NV + `policy_chunks` 10 chunk

### 🤖 n8n Workflows (4/4 Active 🟢, E2E Pass ✅)
- [x] WF01 Router | WF02 HR Q&A | WF03 Training | WF04 CSKH Zalo

### 🌐 Web Portal (10 views + Firebase Auth + Real-time WS)
- [x] 10 views: dashboard, employees, payroll, ai-agents, cskh-escalation, training, employee-portal, my-training, settings, onboarding
- [x] Firebase Auth Google + Facebook OAuth
- [x] **Redesign panel AI** — aggregate 3 workflow + latency bar (15/09)
- [x] **`useAiSocket` hook** — WebSocket push-only (15/09)
- [x] **Badge live state** (15/09)

### 🌟 4 Killer Features
| # | Feature | Trạng thái |
|:---:|---|:---:|
| 1 | 📍 GPS Geofencing | 🔴 Mobile chưa làm |
| 2 | 🚨 Escalation Alert WS Real-time | 🟢 Xong |
| 3 | 📊 Radar Năng Lực Đào Tạo | Web ✅ / Mobile 🔴 |
| 4 | 🔒 PII Masking & Audit Trail | 🟢 Xong |

> ⚠️ **Cần Mobile App để có đủ 4/4 Killer Features!**

---

*Cập nhật bởi AI Agent (Antigravity) — 2026-09-15 14:46 ICT*  
*Xem chi tiết hôm nay: [[16 - Nhật Ký Ngày 15-09-2026]]*  
*Liên kết: [[00 - Tổng Quan Dự Án]] | [[15 - Refactor Real API Toàn Portal & Review Best Practice]]*