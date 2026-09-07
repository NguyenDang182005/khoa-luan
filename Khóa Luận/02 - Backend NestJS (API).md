---
tags: [khoa-luan, backend, nestjs, typescript, prisma]
created: 2026-09-04
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
| **Auth** | JWT (Access Token + Refresh Token) |
| **Realtime** | Socket.io (WebSocket) |
| **API Docs** | Swagger UI |

## Cấu Trúc Modules (`apps/api/src/`)

```
src/
├── auth/            # JWT Auth, login, refresh token
├── users/           # User management
├── employees/       # Quản lý nhân viên
├── departments/     # Phòng ban + phân cấp
├── attendance/      # Chấm công
├── leave/           # Đơn xin nghỉ
├── payroll/         # Tính lương (Rule Engine)
├── contracts/       # Hợp đồng lao động
├── salary-config/   # Cấu hình hệ số lương
├── onboarding/      # Quản lý task onboarding
├── ai-context/      # Context endpoint cho n8n agents
├── notifications/   # WebSocket real-time notifications
└── prisma/          # PrismaService
```

## Dependencies Chính

| Package | Mục đích |
|---------|----------|
| `@nestjs/websockets` + `socket.io` | WebSocket real-time |
| `@nestjs/jwt` + `passport-jwt` | JWT authentication |
| `@nestjs/swagger` | API documentation |
| `@nestjs/throttler` | Rate limiting |
| `@nestjs/schedule` | Cron jobs |
| `@repo/database` | Prisma client (workspace) |
| `@repo/shared-types` | Types dùng chung với FE |

## Rate Limiting Config

```typescript
ThrottlerModule.forRoot([
  { name: 'short',  ttl: 1000,  limit: 10  },   // 10 req/s
  { name: 'medium', ttl: 10000, limit: 50  },   // 50 req/10s
  { name: 'long',   ttl: 60000, limit: 200 },   // 200 req/min
])
```

## Rule Engine Tính Lương

Module `payroll/` thực thi thuật toán làm chủ:
- Lương cơ bản + phụ cấp + thưởng
- Khấu trừ: BHXH (8%), BHYT (1.5%), BHTN (1%)
- Thuế TNCN (giảm trừ gia cảnh: 11 triệu)
- Lương OT: 1.5x ngày thường, 2.0x cuối tuần, 3.0x ngày lễ

---

*Liên kết:* [[00 - Tổng Quan Dự Án]] | [[05 - Database Schema (Prisma)]]
