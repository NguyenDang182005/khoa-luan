---
tags: [khoa-luan, backend, nestjs, typescript, prisma]
created: 2026-09-04
updated: 2026-10-16
---

# ⚙️ Backend NestJS (API)

## Thông Tin

| Mục | Giá trị |
|-----|----------|
| **Framework** | NestJS 11 (TypeScript) |
| **Port** | 3001 |
| **Path** | `apps/api/` |
| **ORM** | Prisma |
| **Database** | PostgreSQL 16 |
| **Auth** | JWT (Access + Refresh Token) + Firebase OAuth (Google/Facebook) |
| **Realtime** | Socket.io (WebSocket) |
| **API Docs** | Swagger UI (`/docs`) |
| **Global Prefix** | `/api/v1` |

## Cấu Trúc Modules (`apps/api/src/`) — 18 modules

```
src/
├── auth/            # JWT Auth, login, Firebase OAuth, password policy
│   ├── guards/      # JwtAuthGuard, RolesGuard
│   ├── strategies/  # JwtStrategy
│   ├── decorators/  # @Roles()
│   ├── password-policy.ts  # Validate mật khẩu theo SecurityPolicy
│   └── require-secret.ts   # Helper đọc secret env
├── users/           # User management (ADMIN only)
├── employees/       # Quản lý nhân viên, tạo mới, reset password, update account
│   └── dto/         # CreateEmployeeDto, ResetPasswordDto, UpdateAccountDto
├── departments/     # Phòng ban + phân cấp + chức vụ (PositionsController)
├── attendance/      # Chấm công (GPS geofencing, check-in/out, báo cáo tháng)
├── leave/           # Đơn xin nghỉ (nộp/duyệt/từ chối/hủy + balance)
│   └── leave-entitlement.ts  # computeBalance, countWorkdays, pro-rate
├── payroll/         # Tính lương Rule Engine (PIT 7 bậc, BHXH/BHYT/BHTN, OT)
│   └── dto/         # PayrollMeQueryDto
├── contracts/       # Hợp đồng lao động
├── salary-config/   # Cấu hình hệ số lương theo năm
├── onboarding/      # Quản lý task onboarding (auto-assign khi tạo NV)
├── training/        # Đào tạo: quiz, roleplay, chấm điểm AI, dashboard
├── ai-context/      # Context endpoints cho n8n + escalation + session mgmt
│   └── ApiKeyGuard  # x-api-key header validation
├── agents/          # AI Agents: portal chat proxy, performance, PII audit
│   └── portal.controller.ts  # Endpoints JWT cho Web Portal
├── dashboard/       # Dashboard thống kê tổng hợp
├── notifications/   # WebSocket real-time notifications (Gateway)
├── settings/        # Trang Cài Đặt: LeavePolicy, SecurityPolicy, AiAgentConfig, Geofence, Audit Log
│   ├── settings-audit.service.ts  # Ghi nhật ký thay đổi cài đặt
│   └── single-row.utils.ts        # ensureDefault* cho bản ghi đơn
├── knowledge/       # RAG: tìm kiếm tri thức chính sách (pgvector)
├── slack/           # Slack Bolt integration (CSKH transport)
├── firebase/        # FirebaseAdminService (verify OAuth token)
├── common/          # PrismaExceptionFilter, vn-date utils
└── prisma/          # PrismaService (Global Module)
```

## Endpoints Chính (by Module)

### Auth (`/api/v1/auth/`)
| Method | Path | Mô tả |
|--------|------|--------|
| POST | `/login` | Đăng nhập email/password (lockout sau N lần sai) |
| POST | `/login/firebase` | Đăng nhập Google/Facebook OAuth (whitelist) |
| POST | `/logout` | Đăng xuất (xóa refresh token) |
| POST | `/change-password` | Đổi mật khẩu (JWT, thu hồi phiên khác) |
| GET | `/profile` | Thông tin profile |

### AI Context — n8n (`/api/v1/n8n/`) — Guard: `x-api-key`
| Method | Path | Mô tả |
|--------|------|--------|
| GET | `/employee-context/:id` | Context nhân viên cho LLM (hỗ trợ UUID và EMP code) |
| GET | `/payroll-context/:id` | Context lương cho LLM |
| POST | `/chat/session` | Tạo/lấy session (kèm messages[], quy tắc phiên theo ngày VN) |
| POST | `/chat/message` | Lưu message + emit WebSocket ai:activity |
| GET | `/chat/history/:sessionId` | Lịch sử hội thoại |
| POST | `/escalate` | Escalate CSKH lên Admin (tạo notification + WS) |
| POST | `/chat/session/:id/reactivate` | Bật lại bot sau escalation |
| POST | `/outbound-reply` | Gửi phản hồi AI ra Slack (channel/thread mode) |

### Agents (`/api/v1/agents/`) — Guard: JWT
| Method | Path | Mô tả |
|--------|------|--------|
| GET | `/performance` | Metrics 4 AI Agents (latency, success rate) |
| GET | `/intent-stats` | Thống kê intent Router (HR_QA/CSKH/TRAINING/OTHER) |
| POST | `/chat` | Portal chat → n8n proxy (timeout 90s, quota handling) |
| GET | `/chat-session/latest` | Phiên gần nhất (rehydrate cùng ngày VN) |
| POST | `/chat-session/renew` | Đóng phiên cũ + mở phiên mới |
| GET | `/pii-audit` | Audit PII messages (limit 1-100) |
| GET | `/conversations` | Hội thoại CSKH (bot + escalated) |
| GET | `/onboarding/my` | Onboarding tasks cá nhân |
| POST | `/chat-session/:id/reply` | Human reply + forward Slack |

### Training (`/api/v1/training/`) — Guard: JWT
| Method | Path | Mô tả |
|--------|------|--------|
| POST | `/submit` | Nộp bài quiz + chấm điểm (WF03 + server-side MCQ) |
| GET | `/dashboard/me` | Dashboard cá nhân (by scenario) |
| GET | `/dashboard/overview` | Dashboard toàn công ty (Admin, by dept) |
| GET | `/analytics` | Phân tích đào tạo theo tháng (radar 4 tiêu chí) |

### Settings (`/api/v1/settings/`) — Guard: JWT + ADMIN
| Method | Path | Mô tả |
|--------|------|--------|
| GET/PATCH | `/leave-policy` | Chính sách phép năm (quota, pro-rate, carry-over) |
| GET/PATCH | `/security-policy` | Chính sách bảo mật (lockout, password rules, token TTL) |
| GET/PATCH | `/ai-config` | Cấu hình AI Agent (enabled, webhook, timeout) |
| POST | `/ai-config/test` | Test kết nối n8n (healthz + round-trip) |
| GET/PATCH | `/geofence` | Vùng chấm công GPS (lat/lng/radius) |
| GET | `/audit-log` | Nhật ký thay đổi cài đặt (phân trang) |
| GET | `/integrations` | Trạng thái tích hợp (DB/n8n/Slack/Gemini) |
| GET | `/sessions` | Phiên đăng nhập active (không lộ token) |
| DELETE | `/sessions/:id` | Thu hồi phiên |
| GET | `/login-history` | Lịch sử đăng nhập |

## Rule Engine Tính Lương

Module `payroll/` thực thi thuật toán:
- Lương cơ bản × (actualWorkingDays / workingDays) + phụ cấp + thưởng
- OT phân loại: 1.5x ngày thường, 2.0x cuối tuần, 3.0x ngày lễ
- Khấu trừ BHXH (8%), BHYT (1.5%), BHTN (1%) — trần 36 triệu
- Thuế TNCN 7 bậc lũy tiến (giảm trừ gia cảnh 11 triệu)
- Ngày phép có lương (ANNUAL/SICK) tính vào actualWorkingDays

## Security Features

- **Password Policy**: cấu hình động từ DB (độ dài, uppercase/lowercase/digit/special)
- **Account Lockout**: khóa sau N lần sai (mặc định 5 lần, 15 phút)
- **Login History**: ghi log mọi lần đăng nhập (IP, User-Agent, thành công/thất bại)
- **Session Management**: Admin xem/thu hồi phiên đăng nhập
- **Settings Audit Log**: nhật ký thay đổi cài đặt (ai sửa, giá trị cũ → mới)
- **PII Masking**: regex masking CCCD/SĐT/Email trong WF01
- **Quiz Anti-cheat**: server stash đáp án, không tin client gửi

## Cron Jobs

| Schedule | Module | Mô tả |
|----------|--------|--------|
| `0 0 * * *` (00:00 VN) | AiContextService | Bật lại CSKH sessions bị escalate + gửi greeting Slack |

---

*Liên kết:* [[00 - Tổng Quan Dự Án]] | [[05 - Database Schema (Prisma)]] | [[06 - n8n Workflows & AI Agents]] | [[09 - Task Checklist]]