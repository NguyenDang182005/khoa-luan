# ✅ Task Checklist & Kế Hoạch Tính Năng Cần Phát Triển

> Cập nhật: **2026-11-02** | Đánh giá tổng thể: **~95% hoàn thành**
> Người cập nhật: AI Agent (Claude Code)

---

## 🚀 Cập Nhật 02/11 — Báo Cáo Khóa Luận Chương 4-5 & 22 Biểu Đồ Mermaid

- [x] **Google Doc báo cáo:** thêm Chương 4 (cài đặt & thực nghiệm), Chương 5 (đánh giá & hướng phát triển), Kết luận, mục lục, tài liệu tham khảo [14]–[41]
- [x] **22 biểu đồ Mermaid** cho toàn bộ chức năng — nguồn `docs/diagrams/*.mmd`, ảnh PNG/SVG render local
- [x] **Sửa Chương 1–3 khớp code:** 2 role ADMIN/EMPLOYEE, thuế TNCN 7→5 bậc từ 01/7/2026, nhãn `[MASKED_*]`, JWT 30 ngày/720h, routing 1 trang
- [x] **Kiểm thử thật:** Jest 47/47, endpoints 55/57, security 12/12 (+12/14 phần đổi mật khẩu)
- [x] **Thực nghiệm Router:** 80 câu có nhãn → accuracy 83,8%, macro-F1 0,838, 0,05 ms/tin nhắn (`scripts/eval/`)
- [ ] Chèn ảnh PNG từ `docs/diagrams/` vào Google Doc (thủ công)
- [x] **Rà soát & sửa 16 lỗi mã nguồn** — webhook n8n có khóa, WF04 tắt bot đúng, form OT, ownership `POST /leave`, geofence server-side, giảm trừ thống nhất, socket kiểm tra phiên, lint sạch; Jest 49/49, endpoints 59/59, security 12/12
- [x] **Google Doc:** trích dẫn `[n]` dạng chỉ số trên, không footnote (03/11); mục 5.3 thành "Rà soát mã nguồn và hạn chế còn lại" kèm Bảng 5.3; cập nhật Chương 3–5 và 4 biểu đồ
- [ ] Sửa `scripts/setup-n8n.mjs` cho API credential của n8n mới; cố định phiên bản image n8n
- [ ] Đối chiếu văn bản gốc NĐ 161/2026/NĐ-CP (tài liệu [18])
- [ ] Commit các thay đổi

*Xem chi tiết: [[31 - Báo Cáo Khóa Luận - Chương 4-5 & Biểu Đồ Mermaid (02-11-2026)]] · [[32 - Rà Soát & Sửa 16 Lỗi Mã Nguồn (02-11-2026)]]*

---

## 🚀 Cập Nhật 14/10 — Audit 20 Lỗi, Debug n8n Live, Tối Ưu UI, Bỏ Phép Thâm Niên, Xóa Cộng Thêm Ngày Phép

- [x] **Audit 20 lỗi toàn hệ thống** — security (JWT fail-fast, webhook headerAuth), RBAC API, ngày VN, chấm MCQ server-side, P2025→404, 6 fix UI, dọn dead code
- [x] **Debug 4 lỗi xếp lớp trên n8n live** — credential thiếu → Gemini cred sai → `employee-context` 500 do spread sai where Prisma; cả 4 intent chat thật pass
- [x] **Tối ưu UI/UX toàn diện** — lược bỏ nút thừa/icon trang trí trên 20+ màn hình
- [x] **Bỏ quy định phép thâm niên 5 năm** — BE `leave-entitlement.ts` (17/17 unit tests), FE `leave-policy-section.tsx`, DB `leave_policies`, RAG `policy_chunks` 10/10 chunks
- [x] **Chuẩn hóa Context WF01–WF04** — đồng bộ `systemMessage`, sửa tool `GetPayrollContext` WF02, bổ sung `companyPolicy` WF03, chuẩn hóa định tuyến TRAINING/CSKH WF01
- [x] **Xóa toàn bộ cơ chế cộng thêm ngày phép** — đồng bộ context WF02-WF03
- [x] E2E pass 7/7 kịch bản trên n8n live, 39/39 tests, build xanh

*Xem chi tiết: [[26 - Nhật Ký Ngày 14-10-2026 (Audit 20 Lỗi & Debug n8n Live)]] · [[27 - Nhật Ký Ngày 14-10-2026 (Tối Ưu UI-UX, Bỏ Phép Thâm Niên & Chuẩn Hóa Context WF01-WF04)]] · [[28 - Nhật Ký Ngày 14-10-2026 (Xóa Toàn Bộ Cơ Chế Cộng Thêm Ngày Phép & Đồng Bộ Context WF02-WF03)]]*

---

## 🚀 Cập Nhật 23/09 — Router Gateway Hub & Fix Bug Đào Tạo

- [x] **Redesign Bảng Thông Báo Router (WF01)** — Router Gateway Hub 3 tab: Sandbox PII & Intent, Quy Chuẩn Bảo Mật, Live Audit Trail
- [x] **Khôi phục WF04 (Zalo CSKH & Escalation Agent)** — tab riêng biệt chứa bảng thông báo Slack
- [x] **Fix Zod Schema crash Training** — nới lỏng `AiScoreSchema` với `.nullish().passthrough()`
- [x] **Fix bug điểm vượt khung (100/50) và âm (-27.5/50)** — chuẩn hóa thang điểm
- [x] Kết quả kiểm thử: `web check-types` 0 errors ✅, `api build` 0 errors ✅

---

## 🚀 Cập Nhật 17/09 — Training Quiz & Dashboard

- [x] **WF03 Training Agent viết lại hoàn toàn** — webhook + 3 luồng
- [x] **NestJS Training endpoints** — submit, dashboard/me, dashboard/overview
- [x] Kết quả kiểm thử: 5 MCQ + 2 essay ✅, WF02 7.8s ✅, WF03 roleplay 6s ✅

---

## 🚀 Cập Nhật 15/09 — Fix Bug & Real-time WebSocket

- [x] **Kiểm tra 37 endpoint** — fix 4 endpoint 500 (NaN crash)
- [x] **WebSocket real-time AI panel** — `emitAiActivity()`, `useAiSocket` hook

---

## 🚀 Cập Nhật 14/09 — Mở Rộng Tính Năng & Dữ Liệu Demo

- [x] **Duyệt lương hàng loạt** — `POST /payroll/approve-bulk` & `paid-bulk`
- [x] **CSKH kênh Zalo — transport Slack** — WF04 + tab hội thoại
- [x] **Trang Cài Đặt** (`settings-view`, chỉ ADMIN)
- [x] **Seed demo đầy đủ** — 30 NV, 2.183 chấm công, 4 phiên AI
- [x] **RAG kho tri thức chính sách** — `policy_chunks` + Gemini embedding + WF02 tool

---

## 📊 Bảng Tiến Độ Tổng Thể

| Hạng mục | Trước | Hiện tại | Ghi chú |
|---|:---:|:---:|---|
| Backend NestJS (18 modules) | 98% | **98%** ✅ | Ổn định, 18 modules, 50+ endpoints |
| Database Schema | 100% | **100%** ✅ | 22 models, 14 enums, 5 settings models |
| Database Seed | 100% | **100%** ✅ | 30 NV, RAG 10 chunks |
| n8n AI Workflows (4 WF) | 100% | **100%** ✅ | WF01-04 đều pass E2E |
| Web Portal — UI (10 views) | 100% | **100%** ✅ | Router Hub, Settings 7 sections |
| Web Portal — API | 100% | **100%** ✅ | Zod schemas, API clients |
| Firebase Auth (OAuth) | 90% | **90%** ✅ | Google + Facebook, whitelist |
| Real-time WebSocket | 90% | **90%** ✅ | AI activity, escalation alerts |
| Mobile App | — | **Đã cắt scope** | Hướng phát triển — ADR-0003 |
| RAG / pgvector | 85% | **85%** ✅ | 10 policy chunks, embedding search |
| Báo cáo luận văn | 35% | **35%** | Cần tập trung Sprint 5 |
| **Tổng** | **95%** | **95%** | |

---

## ❌ CHƯ A LÀM — Cần thực hiện

### 🔴 P0 — Critical

#### Mobile App — ĐÃ CẮT KHỎi SCOPE (quyết định 25/09)
> Không còn là P0. Mobile App chuyển thành **hướng phát triển** ([[23 - Quyết Định Web-Only Phase 1 (Cắt Mobile App)]] | `docs/adr/0003-web-only-client-phase-1.md`).

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

## ✅ ĐÃ HOÀN THÀNH (tích lũy đến 14/10/2026)

### 🏗️ Hạ tầng
- [x] Monorepo Turborepo + pnpm + TypeScript + Docker + Prisma

### 🖥️ Backend NestJS (18 modules)
- [x] Auth (JWT + Refresh + Firebase OAuth) | RolesGuard | 2-role (ADMIN/EMPLOYEE)
- [x] Employees (tạo/sửa/reset password/update account) | Departments | Contracts | Attendance | Leave | Payroll
- [x] SalaryConfig | Onboarding | Notifications + WebSocket
- [x] AI Context Bridge (n8n endpoints, session mgmt, escalation, outbound reply)
- [x] Dashboard | Agents (portal chat proxy, performance, PII audit, intent stats)
- [x] Training (quiz submit, grade, dashboard/me, dashboard/overview, analytics)
- [x] Settings (LeavePolicy, SecurityPolicy, AiAgentConfig, Geofence, Audit Log, Integrations, Sessions, LoginHistory)
- [x] Knowledge (RAG pgvector) | Slack (Bolt integration)
- [x] Security: password policy, account lockout, login history, session mgmt, settings audit, PII masking, quiz anti-cheat
- [x] Cron: midnight reset CSKH sessions + Slack greeting

### 🗄️ Database
- [x] 22 models + 14 enums | Seed 30 NV + `policy_chunks` 10 chunks
- [x] 5 Settings models (bản ghi đơn): OfficeGeofence, LeavePolicy, SecurityPolicy, AiAgentConfig, SettingsAuditLog

### 🤖 n8n Workflows (4/4 Active 🟢, E2E Pass ✅)
- [x] WF01 Router | WF02 HR Q&A | WF03 Training | WF04 CSKH Zalo
- [x] Gemini 3.1 Flash Lite cho tất cả 4 workflow
- [x] PII Masking (regex, 0 LLM) trong WF01 + WF04

### 🌐 Web Portal (10 views + Firebase Auth + Real-time WS)
- [x] 10 views: dashboard, employees, payroll, ai-agents, cskh-escalation, training, employee-portal, my-training, settings, onboarding
- [x] Firebase Auth Google + Facebook OAuth (whitelist)
- [x] Settings View: 7 sections (LeavePolicy, Security, AiAgent, Geofence, Salary, Integrations, AuditLog)
- [x] Router Gateway Hub 3 tab — Interactive Sandbox + Pipeline Standards + Live Audit Trail
- [x] Fix thang điểm Hybrid Assessment — Trắc nghiệm 50% + Tự luận 50%
- [x] Audit cơ chế chấm điểm + fix Radar 4 tiêu chí (25/09)
- [x] Audit OAuth whitelist + vá RBAC (25/09)

### 🌟 4 Killer Features
| # | Feature | Trạng thái |
|:---:|---|:---:|
| 1 | 📍 GPS Geofencing | 🟢 Web ESS ✅ |
| 2 | 🚨 Escalation Alert WS Real-time | 🟢 Xong |
| 3 | 📊 Radar Năng Lực Đào Tạo | 🟢 Web ✅ |
| 4 | 🔒 PII Masking & Audit Trail | 🟢 Xong |

---

*Cập nhật bởi AI Agent — 2026-10-16*
*Liên kết: [[00 - Tổng Quan Dự Án]] | [[03 - Web Portal (Next.js)]] | [[14 - Training Quiz & Dashboard]] | [[26 - Nhật Ký Ngày 14-10-2026 (Audit 20 Lỗi & Debug n8n Live)]] | [[27 - Nhật Ký Ngày 14-10-2026 (Tối Ưu UI-UX, Bỏ Phép Thâm Niên & Chuẩn Hóa Context WF01-WF04)]] | [[28 - Nhật Ký Ngày 14-10-2026 (Xóa Toàn Bộ Cơ Chế Cộng Thêm Ngày Phép & Đồng Bộ Context WF02-WF03)]]*

## 🚀 Cập Nhật 17/10 — Business Logic Verified & ADR Alignment

- [x] **Tạo note Business Logic & ADR Alignment** — Verified toàn bộ logic từ source code (xem [[30 - Business Logic & ADR Alignment (Verified 17-10-2026)]])
- [x] **Xác minh 3 ADR** — ADR-0001 (Postgres Chat Memory) ✅, ADR-0002 (NestJS RAG Middleware) ✅, ADR-0003 (Web-only Phase 1) ✅
- [x] **Xác minh nghỉ phép 12 ngày** — `annualQuotaDays: @default(12)` trong schema.prisma, `seniorityBonus = 0` (hardcode), `carryOver = 0` (hardcode), 17/17 unit tests confirm
- [x] **Xác minh Payroll Rule Engine** — 7 bậc PIT, cap BH 36M, OT 3 mức (1.5x/2.0x/3.0x), ngày phép có lương tính ngày công
- [x] **Xác minh Chat Session Lifecycle** — Day-based rollover VN timezone, session ownership Q18, midnight cron reset CSKH
- [x] **Xác minh Quiz Anti-Cheat** — Server stash đáp án, submit không tin client, scoring `quizScore×0.5 + essayAvg×10×0.5`
- [x] **Xác minh Auth Security** — Account lockout (maxFailedAttempts → lockoutMinutes), JWT handshake WebSocket, password change revokes other sessions
- [x] **Cập nhật note 01, 03, 06, 08** — Thêm WF05, ADR alignment, Training scenarios đầy đủ (6), Slack Socket Mode, Settings 7 sections

*Cập nhật bởi AI Agent — 2026-10-17*
*Liên kết: [[30 - Business Logic & ADR Alignment (Verified 17-10-2026)]] | [[29 - Snapshot Toàn Hệ Thống 16-10-2026]]*