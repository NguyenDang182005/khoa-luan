---
tags: [khoa-luan, nhat-ky, real-api, best-practice, security, refactor]
created: 2026-09-10
---

# 🔧 Refactor Real API Toàn Portal & Review Best Practice Toàn Repo

> Thời gian: Phiên làm việc 09–10/09/2026
> Thực hiện bởi: AI Agent (DeepSeek Harness) + Lập trình viên
> Phạm vi: Review 4 khu vực (Backend / Frontend / Hạ tầng / n8n + Tài liệu) → Refactor "xóa 100% mock data" cho Web Portal

---

## 📋 PHẦN 1 — KẾT QUẢ REVIEW BEST PRACTICE TOÀN REPO

### Điểm mạnh (giữ nguyên, đúng chuẩn)
- Monorepo Turborepo chuẩn: `workspace:*` 100%, tsconfig strict + `noUncheckedIndexedAccess` dùng chung, ESLint flat-config 3 tầng.
- Backend NestJS: 17 feature module sạch, PrismaService lifecycle chuẩn, Swagger đầy đủ, JWT 2 lớp + bcrypt, `calculatePIT` pure function đúng luật VN.
- Prisma schema: enum đầy đủ, composite unique đúng (`Attendance [employeeId, date]`, `Payroll [employeeId, month, year]`), onDelete có chủ đích.
- n8n: đúng `gemini-2.5-flash` + `maxOutputTokens: 1024` theo AGENTS.md, PII Masking trước LLM ở WF01, Postgres Chat Memory đúng ADR-0001, Escalation đúng thiết kế.
- Frontend nền tốt: Zod parse thật tại runtime boundary, auth Firebase→JWT đúng pattern, file ≤ ~500 dòng.

### Vấn đề nghiêm trọng tìm thấy (theo mức độ)
| # | Mức | Vấn đề | Vị trí |
|---|---|---|---|
| 1 | 🔴 Critical | Secret thật trong git: mật khẩu Gmail/n8n owner, GEMINI_API_KEY, HR API JWT (6 vị trí), key `n8n-hr-secret-key-123` hardcode trong client component | `scripts/import-workflows.mjs`, `scripts/setup-n8n.mjs`, `n8n-workflows/02-hr-qa-agent.json`, `employee-portal-view.tsx` |
| 2 | 🔴 Critical | `NEXT_PUBLIC_N8N_API_KEY` bị inline vào browser bundle → ai cũng gọi được `/n8n/*`, RBAC thành cosmetic | `escalation.api.ts`, `agents.api.ts` |
| 3 | 🔴 Critical | 2 bug chắc chắn 500: payroll generate truyền `_breakdown` không có trong schema; escalate dùng user sentinel `admin-broadcast` vi phạm FK | `payroll.service.ts`, `ai-context.service.ts` |
| 4 | 🔴 Critical | RolesGuard + @Roles viết xong nhưng 0 lần dùng; WebSocket gateway không auth, join room theo client | `app.module.ts`, `notifications.gateway.ts` |
| 5 | 🔴 Critical | WF04 ưu tiên `originalMessage` trước `maskedMessage` → PII Masking vô hiệu trên luồng CSKH | `04-zalo-cskh.json` (⚠️ chưa fix) |
| 6 | 🟠 High | Quality gates đứt: `pnpm lint` fail 2/5 workspace, `pnpm test` fail (0 test), không CI, 2 migration chưa commit | toàn repo |
| 7 | 🟠 High | Web mock disguised as real: payroll-view 100% cứng, form nghỉ phép dead code, PII audit tĩnh, TanStack Query cài mà 0 import | `apps/web/components/views/*` |
| 8 | 🟡 Medium | 13 điểm tài liệu tự mâu thuẫn: "Gemini 3.5" ↔ 2.5, "Next.js 14" ↔ 16, GraphRAG ↔ pgvector, README n8n stale | README.md, doc 01/03/06/07/12 |

> **Đánh giá:** ~83% hoàn thành là đúng theo *độ phủ tính năng demo*, nhưng theo trục best-practice chỉ ~55–60% (trước refactor).

---

## 🛠️ PHẦN 2 — REFACTOR "XÓA 100% MOCK DATA" (đã hoàn thành)

### A. Backend — 2 bug fix + endpoint mới (build 0 lỗi)

**Bug fix:**
1. `payroll.service.ts` — destructuring `_breakdown` ra khỏi data trước khi ghi DB; HTTP response vẫn trả kèm `breakdown`. Hết PrismaClientValidationError ở `/payroll/generate(-bulk)`.
2. `ai-context.service.ts` — bỏ sentinel `admin-broadcast`; tạo 1 Notification cho từng user role ADMIN/HR_MANAGER/HR_ADMIN (mỗi create có `.catch()` riêng).

**Endpoint mới (prefix `/api/v1`, file chính `apps/api/src/agents/portal.controller.ts`):**

| Route | Guard | Mô tả |
|---|---|---|
| `POST /agents/chat` | JwtAuthGuard | Proxy n8n WF01 server-side (x-api-key gắn tại backend), trả `{ answer, latencyMs }`, n8n lỗi → 502 |
| `GET /agents/escalation-queue` | Jwt + Roles (ADMIN_GROUP) | Hàng đợi escalate (reuse service cũ) |
| `GET /agents/chat-history/:sessionId` | ADMIN_GROUP | `{ messages: [...] }` |
| `POST /agents/chat-session/:id/reactivate` | ADMIN_GROUP | Bật lại bot |
| `POST /agents/chat-session/:id/reply` | ADMIN_GROUP | Lưu tin nhắn tiếp quản (`metadata.sender='human'`) |
| `GET /agents/pii-audit?limit=` | ADMIN_GROUP | Nhật ký PII thật từ `AiChatMessage` |
| `GET /agents/onboarding/my` | JwtAuthGuard | `{ items: [{ id, title, isCompleted, ... }] }` |
| `GET /payroll/me?month=&year=` | JwtAuthGuard | Phiếu lương của chính mình, mặc định tháng hiện tại giờ VN |
| `POST /employees` | JwtAuthGuard | Tạo nhân viên không cần userId (tự sinh placeholder user inactive + auto employeeCode + gán onboarding) |
| `GET /positions` | JwtAuthGuard | `[{ id, title, code }]` |

**Dashboard trung thực:** `activeWorkflows` đếm distinct workflow thật từ metadata 7 ngày (max 3 — WF01 không persist metadata); bỏ fallback 98.4% → `null`.
**Chính sách env:** env đã có (`N8N_API_KEY`) → kiểm tra/dùng; env mới (`N8N_WEBHOOK_URL`, `NEXT_PUBLIC_OFFICE_*`) → có fallback in-code, không chặn khởi động.

### B. Seed (chạy lại `pnpm run db:seed` để áp dụng)
- `hr-admin@company.com` / `Admin@123` — role HR_ADMIN + Employee EMP006.
- `employee1@company.com`, `employee2@company.com` / `Employee@123` — EMPLOYEE, được trỏ vào EMP005 / EMP003 (vì `Employee.userId` unique, các employee seed cũ đã có user).

### C. Frontend — từng trang (typecheck ✓, lint 0 cảnh báo ✓, production build ✓)

| Trang | Trước | Sau |
|---|---|---|
| **Bảng Lương** | 100% mock, Rule Engine giả (setTimeout) | Chọn kỳ → generate-bulk thật, duyệt/chi trả từng dòng, SalaryConfig từ API, xuất CSV |
| **Cổng Nhân Viên** | GPS/payslip/checklist cứng, form nghỉ phép dead code, chat có key cứng | Check-in/out **GPS thật** (Haversine, chặn quá bán kính), phiếu lương thật `/payroll/me`, form nghỉ phép validate Zod + gửi thật, onboarding thật, chat qua backend |
| **Nhân Sự** | Fetch mỗi keystroke, drawer cứng 15tr/12 ngày | Debounce 300ms + pagination UI, drawer đọc hợp đồng active + phép năm + đơn nghỉ thật, Thêm Nhân Viên hoạt động, xuất CSV; fix schema parse envelope `{meta}` |
| **Bảng Điều Hành** | +5.2% cứng, YAxis [200,260] | Bỏ số fake, trục tự scale, dialog nhập lý do từ chối, KPI null-safe |
| **AI Sandbox** | Accuracy 96–99% cứng, fallback EMP001 | Accuracy `--` khi chưa có data, chat qua `/agents/chat` (JWT) |
| **CSKH Escalation** | Reply không đi đâu, PII audit tĩnh, banner WS giả | Reply lưu phiên thật qua backend, PII audit đọc từ DB, hiển thị metadata thật (`escalated/escalateReason/lastMessage`), bỏ nút chuông giả |
| **Đào Tạo (2 trang)** | Đề xuất cứng, axis label sai, @ts-ignore | Đề xuất = tiêu chí lệch chuẩn lớn nhất tự tính, fix `dataKey="subject"`, map tên kịch bản TV |
| **Shell + Login** | ⌘K chết, dot "live" giả, prefill admin | ⌘K/ESC hoạt động, search lọc nav thật, bỏ dot giả, bỏ prefill |

**Kiểm chứng bảo mật:** `grep NEXT_PUBLIC_N8N|n8n-hr-secret-key` trên `apps/web` → **0 kết quả**. Browser chỉ giữ JWT, mọi call AI đi qua NestJS.

---

## ❓ PHẦN 3 — GHI NHỚ KIẾN TRÚC: SERVER-SIDE FETCH + ZOD

Câu hỏi: vì sao không để Next fetch API ở server (RSC) rồi Zod validate?

- **Lợi ích:** chặn dữ liệu sai shape trước khi tới browser; secret không bao giờ public; có thể dùng httpOnly cookie thay localStorage; giảm CORS/waterfall.
- **Cại hiện tại:** JWT nằm trong `localStorage` → Server Component không đọc được; các view cần realtime (chat, polling) vẫn phải là client component.
- **3 hướng:** (A) RSC fetch + parse + truyền props xuống client view — cần chuyển JWT sang httpOnly cookie trước; (B) Route Handler làm BFF proxy — ít thay đổi nhất; (C) giữ client-side Zod như hiện tại.
- **Khuyến nghị:** bước kế tiếp đáng giá nhất là **chuyển JWT sang httpOnly cookie** (NestJS set khi login), sau đó áp A cho các trang đọc-nhiều (dashboard/payroll/employees), giữ client cho chat/escalation.

---

## ⏭️ VIỆC CẦN LÀM TIẾP (backlog sau refactor)

1. 🔴 **Rotate secret ngay** (Gmail/n8n password, Gemini key, HR API key) — key đã gỡ khỏi code frontend nhưng **vẫn nằm trong git history + scripts/**.
2. 🔴 Fix PII Masking WF04 (đổi ưu tiên `maskedMessage` trước `originalMessage` — 1 dòng trong JSON).
3. 🟠 Đăng ký APP_GUARD (JwtAuthGuard + RolesGuard) + `@Roles()` các route lương/hợp đồng; WS gateway xác thực handshake.
4. 🟠 DTO class-validator cho các controller cũ; unit test `calculatePayroll`; GitHub Actions tối thiểu; commit 2 migration.
5. 🟡 Decimal cho cột tiền, `@@index` cho FK; error workflow + retry/timeout cho n8n; TTL `n8n_chat_histories`.
6. 🟡 Chốt RAG: pgvector (theo ADR-0002) trước Sprint 4.

---

*Liên kết: [[09 - Task Checklist]] | [[14 - Nhật Ký Ngày 09-09-2026]] | [[13 - Real API & Zod Integration]] | [[12 - Báo Cáo Triển Khai & Kiểm Thử Web Portal (Next.js + shadcn ui)]] | [[00 - Tổng Quan Dự Án]]*
