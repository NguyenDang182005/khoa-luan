---
tags: [khoa-luan, dev-log, snapshot, audit]
created: 2026-10-16
---

# 📸 Snapshot Toàn Hệ Thống — 2026-10-16

> Tổng hợp trạng thái toàn bộ repo từ source code thực tế, không phải từ ghi nhớ.
> Được sinh bởi AI Agent đọc kỹ lại toàn bộ repo ngày 16/10/2026.

---

## 1. Monorepo Structure

| Workspace | Path | Mô tả |
|-----------|------|--------|
| `api` | `apps/api/` | NestJS 11 Backend — 18 modules, 50+ endpoints, port 3001 |
| `web` | `apps/web/` | Next.js Web Portal — 10 views, shadcn/ui, port 3000 |
| `database` | `packages/database/` | Prisma schema (22 models, 14 enums) + seed scripts |
| `shared-types` | `packages/shared-types/` | Types dùng chung FE↔BE (auth, employee, hr) |
| `eslint-config` | `packages/eslint-config/` | ESLint shared config |
| `typescript-config` | `packages/typescript-config/` | TSConfig shared (base, nestjs, nextjs) |

**Build:** Turborepo + pnpm 9.0 | **Runtime:** Node ≥18 | **CI scripts:** `run-all.ps1`

---

## 2. Backend NestJS — 18 Modules

| Module | Service LOC | Endpoints | Business Logic chính |
|--------|:-----------:|:---------:|----|
| `auth` | 338 | 5 | JWT + Firebase OAuth, password policy, lockout, login history |
| `employees` | 460 | 7+ | CRUD, reset password (GENERATE/MANUAL), update account, auto-onboarding |
| `attendance` | 207 | 5 | GPS check-in/out, monthly report, geofence validation |
| `leave` | 295 | 5 | Nộp/duyệt/từ chối, balance (pro-rate, carry-over), transaction |
| `payroll` | 388 | 8 | PIT 7 bậc, BHXH/BHYT/BHTN (trần 36M), OT 3 loại, bulk approve/paid |
| `ai-context` | 592 | 8 | n8n bridge, session mgmt (ngày VN), escalation, Slack outbound, cron midnight |
| `agents` | 393 | 9+ | Portal chat proxy, performance metrics, PII audit, intent stats, quiz stash |
| `training` | 520 | 5 | Quiz submit + WF03 grade, dashboard me/overview, analytics radar |
| `settings` | 433 | 10+ | LeavePolicy, SecurityPolicy, AiAgentConfig, Geofence, Integrations ping, Sessions |
| `notifications` | ~30 | 1 (WS) | WebSocket Gateway (room: admin, ai:activity, escalation) |
| `knowledge` | ~100 | 2 | RAG policy search (pgvector cosine similarity) |
| `slack` | ~80 | — | Slack Bolt (Events API, message listener, echo suppression) |
| `dashboard` | ~50 | 1 | Aggregate stats |
| `departments` | ~60 | 3+ | CRUD + positions |
| `contracts` | ~40 | 3 | CRUD hợp đồng |
| `salary-config` | ~40 | 2 | Cấu hình hệ số lương |
| `onboarding` | ~60 | 3 | Tasks + progress |
| `users` | ~30 | 2 | User management |

### Security Features (từ source code thực tế)

- ✅ **Password Policy** động từ DB (`SecurityPolicy` model)
- ✅ **Account Lockout** sau N lần sai (default 5, 15 phút)
- ✅ **Login History** (IP, UserAgent, success/fail, reason)
- ✅ **Session Management** (xem/thu hồi phiên, không lộ refresh token)
- ✅ **Settings Audit Log** (section, field, oldValue → newValue)
- ✅ **Quiz Anti-cheat** (server stash đáp án, không tin client)
- ✅ **PII Masking** (regex CCCD/SĐT/Email trong WF01)
- ✅ **Rate Limiting** (ThrottlerModule 3 tầng)
- ✅ **PrismaExceptionFilter** (P2025 → 404)
- ✅ **ApiKeyGuard** (x-api-key cho n8n endpoints)

---

## 3. Database — 22 Models, 14 Enums

### Phân nhóm Models

| Nhóm | Models | Số lượng |
|-------|--------|:---------:|
| Core Auth | User, RefreshToken, LoginHistory | 3 |
| HR Domain | Employee, Department, Position, Attendance, LeaveRequest, Contract, Payroll, SalaryConfig | 8 |
| AI & Training | AiChatSession, AiChatMessage, TrainingQuestion, TrainingSession, TrainingAttempt, OnboardingTask, OnboardingProgress, Notification | 8 |
| Settings | OfficeGeofence, LeavePolicy, SecurityPolicy, AiAgentConfig, SettingsAuditLog | 5 |
| **Tổng** | | **22** |

### Enums thực tế (từ schema.prisma)

- `UserRole`: **ADMIN, EMPLOYEE** (chỉ 2 role, không có HR_MANAGER hay MANAGER)
- `TrainingScenario`: 6 giá trị (customer_complaint, colleague_conflict, manager_feedback, new_employee_onboarding, performance_review, general_communication)
- `AttendanceDayType`: NORMAL, WEEKEND, HOLIDAY (phục vụ OT 3 mức)

---

## 4. n8n Workflows — 5 files

| File | Workflow | Trigger | Mô tả |
|------|----------|---------|--------|
| `01-router-agent.json` | WF01 Router | `POST /webhook/chat` | PII Masking (regex) → Intent Detection (rule-based) → Switch Router |
| `02-hr-qa-agent.json` | WF02 HR Q&A | Từ Router | Employee Context + Session → Multi-turn History → Gemini 3.1 Flash Lite |
| `03-training-agent.json` | WF03 Training | Từ Router | 6 scenarios, 3 luồng (generate_quiz/submit_quiz/roleplay), Gemini chấm điểm |
| `04-zalo-cskh.json` | WF04 CSKH | `POST /webhook/zalo-webhook` | Zalo → Gemini → Slack outbound + Escalation keywords |
| `05-slack-verify.json` | WF05 Slack Verify | Slack Events | Challenge response verification |

### Gemini model: `gemini-3.1-flash-lite` cho tất cả 4 workflow

---

## 5. Web Portal — 10 Views

| View | File | Role | Mô tả |
|------|------|------|--------|
| Dashboard | `dashboard-view.tsx` | ADMIN | Thống kê tổng hợp |
| Employees | `employees-view.tsx` | ADMIN | Danh sách NV, tabs: chi tiết/sửa/onboarding/leave approvals |
| Payroll | `payroll-view.tsx` | ADMIN | Bảng lương, bulk approve/paid |
| AI Agents | `ai-agents-view.tsx` | ADMIN | Performance 4 WF, Router Hub 3 tab, WF04 tab |
| CSKH Escalation | `cskh-escalation-view.tsx` | ADMIN | Hội thoại CSKH, human reply |
| Training Analytics | `training-analytics-view.tsx` | ADMIN | Radar 4 tiêu chí, bảng điểm |
| Employee Portal | `employee-portal-view.tsx` | EMPLOYEE | Hồ sơ, chấm công GPS, phép, lương, chat AI |
| My Training | `my-training-view.tsx` | EMPLOYEE | Bài test, kết quả, radar cá nhân |
| Settings | `settings-view.tsx` | ADMIN | 7 sections (LeavePolicy, Security, AI, Geofence, Salary, Integrations, AuditLog) |
| Login | `login-view.tsx` | PUBLIC | Email/password + Google/Facebook OAuth |

### Frontend Stack
- Next.js + React 19 + TypeScript
- Tailwind CSS + shadcn/ui (16 components)
- Zustand (chat store)
- Zod (10 schema files cho validation)
- Socket.io client (useAiSocket hook)
- Firebase Auth (Google/Facebook)

---

## 6. ADRs (Architecture Decision Records)

| ADR | Tiêu đề | Trạng thái |
|-----|---------|:--------:|
| 0001 | PostgreSQL là nguồn sự thật duy nhất cho lịch sử hội thoại AI | Accepted |
| 0002 | NestJS làm RAG middleware — n8n không kết nối DB trực tiếp | Accepted |
| 0003 | Web-only client cho Phase 1 — Mobile App là hướng phát triển | Accepted |

---

## 7. Scripts (50+ tool vận hành)

| Nhóm | Số lượng | Mục đích |
|-------|:--------:|---------|
| `scripts/debug-n8n/` | 20+ | Đọc/patch workflow n8n, debug execution, credential |
| `scripts/diag-browser/` | 7 | Debug UI browser (Puppeteer) |
| `scripts/*.mjs/*.cjs` | 25+ | E2E test, fix data, deploy WF, probe services |

---

*Tạo bởi AI Agent — 2026-10-16 23:59 (giờ VN)*
*Liên kết: [[00 - Tổng Quan Dự Án]] | [[02 - Backend NestJS (API)]] | [[05 - Database Schema (Prisma)]] | [[06 - n8n Workflows & AI Agents]] | [[09 - Task Checklist]]*