---
tags: [khoa-luan, devops, docker, infrastructure, verified]
created: 2026-09-04
updated: 2026-10-17
---

# 🐳 Infrastructure & DevOps

## Docker Compose Services

File: `docker-compose.yml` — chạy 3 service bằng `docker-compose up -d`

| Service | Image | Port | Mục đích |
|---------|-------|------|----------|
| `postgres` | pgvector/pgvector:pg16 *(14/09 — postgres:16 + extension pgvector cho RAG; đổi xong chạy `docker compose up -d postgres` — volume giữ nguyên, rồi seed lại)* | 5432 | Database chính |
| `pgadmin` | dpage/pgadmin4 | 5050 | Quản lý DB qua UI |
| `n8n` | n8nio/n8n:latest | 5678 | AI Agent orchestration |

## Ports Summary

| Service | URL | Credentials |
|---------|-----|-------------|
| **NestJS API** | http://localhost:3001 | — |
| **Next.js Web** | http://localhost:3000 | — |
| **n8n** | http://localhost:5678 | admin / n8n-secret-2024 |
| **pgAdmin** | http://localhost:5050 | admin@hr-system.com / admin123 |
| **PostgreSQL** | localhost:5432 | postgres / postgres123 |

## Monorepo Management (Turborepo)

```bash
# Dev tất cả
pnpm dev

# Build tất cả
pnpm build

# Chỉ dev API
turbo dev --filter=api

# Chỉ dev Web
turbo dev --filter=web
```

## Package Manager

- **pnpm** workspaces
- **Turborepo** cho orchestration build & dev
- Tất cả TypeScript 5.9.2

## Thông Tin n8n ↔ NestJS

```yaml
# n8n gọi vào NestJS:
HR_API_URL: http://host.docker.internal:3001/api/v1
HR_API_KEY: your-n8n-api-key

# n8n Webhook URL:
WEBHOOK_URL: http://localhost:5678
TIMEZONE: Asia/Ho_Chi_Minh
```

### Endpoint cho n8n (x-api-key) — cập nhật 17/10

| Endpoint | Mục đích |
|---|---|
| `GET /n8n/employee-context/:employeeId` | Context nhân viên (WF02 tool — hỗ trợ cả UUID và `EMP003` code) |
| `GET /n8n/payroll-context/:employeeId` | Bảng lương theo tháng (WF02 tool) |
| `GET\|POST /n8n/knowledge-search` | RAG: tìm chunk chính sách (`KnowledgeService`: pgvector `<=>` hoặc cosine fallback) |
| `POST /n8n/chat/session` | Tạo/lấy session (day-based rollover VN timezone) |
| `POST /n8n/chat/message` | Lưu tin nhắn AI (audit trail) |
| `POST /n8n/outbound-reply` | Forward reply AI → Slack channel/DM |
| `POST /n8n/escalate` | Escalation CSKH → WebSocket admin |

### Slack Integration (cập nhật 17/10)

| Thành phần | Chi tiết |
|---|---|
| **SlackModule** | Bolt SDK **Socket Mode** (không cần public URL) |
| **Inbound:** | Channel message → `slack.service.ts` → forward WF04 webhook |
| **Outbound:** | `AiContextService.sendSlackChannelMessage()` qua Slack Web API |
| **Thread-aware:** | Gửi `slackChannel` + `threadTs` → reply trong thread + broadcast ra kênh |
| **Bot loop guard:** | Metadata `event_type: 'hr_agent_reply'` → Bolt listener bỏ qua tin của chính bot |

## Bảng API Keys & Secrets (cập nhật 17/10)

Toàn bộ secret thật nằm trong **root `.env`** (đã gitignored) — `docker-compose.yml` chỉ tham chiếu `${VAR:-}`; NestJS đọc từ `apps/api/.env`; **browser không bao giờ giữ key n8n/Slack/Gemini** (chỉ JWT đăng nhập).

| Biến môi trường | Giá trị dùng để | Nơi định nghĩa | Ai giữ |
|---|---|---|---|
| `HR_API_KEY` | n8n → NestJS qua header `x-api-key` (tất cả endpoint `/api/v1/n8n/*`) | root `.env` + `apps/api/.env` (phải khớp nhau) | Backend + n8n credential `httpHeaderAuth` |
| `N8N_API_KEY` | NestJS validate header `x-api-key` incoming | `apps/api/.env` | Backend |
| `GEMINI_API_KEY` | n8n gọi Gemini 3.1 Flash Lite (WF02–WF04) + embedding RAG | root `.env` → n8n credential `googlePalmApi` | n8n credential |
| `SLACK_BOT_TOKEN` (`xoxb-…`) | NestJS Bolt Socket Mode + gửi Slack channel message | root `.env` → NestJS `ConfigService` | Backend only |
| `SLACK_SIGNING_SECRET` | Verify signature Slack Events (khi bật HTTP mode) | root `.env` | Backend only |
| `SLACK_APP_TOKEN` (`xapp-…`) | Bolt Socket Mode connection | root `.env` | Backend only |
| `SLACK_CHANNEL_ID` | Channel cho midnight greeting + CSKH reply | root `.env` | Backend only |
| `DATABASE_URL` | Prisma connect PostgreSQL | `apps/api/.env` / env khi chạy | Backend |
| `NEXT_PUBLIC_FIREBASE_*` | Firebase Web SDK đăng nhập OAuth | `apps/web/.env.local` | Browser (public by design) |
| `N8N_URL` | NestJS ping `/healthz` + proxy chat tới WF01 | `apps/api/.env` | Backend |
| ~~`NEXT_PUBLIC_N8N_*`~~ | ~~Key n8n trong browser~~ — **đã xóa** (14/09) | — | — |

> 🔁 Luồng gọi có key: `Browser (JWT) → NestJS → (x-api-key) → n8n → (x-api-key) → NestJS`; gửi tin khách: `NestJS → Slack Web API (Bearer)`. Không có đường nào đưa secret xuống browser.

## Shared Packages

| Package | Export |
|---------|--------|
| `@repo/database` | PrismaClient, models |
| `@repo/shared-types` | TypeScript types FE ↔ BE |
| `@repo/ui` | React component library |
| `@repo/eslint-config` | ESLint rules |
| `@repo/typescript-config` | tsconfig bases |

## Cron Jobs (NestJS)

| Cron | Service | Mô tả |
|---|---|---|
| `0 0 * * *` (VN) | `AiContextService.midnightResetEscalatedSessions` | Bật lại tất cả CSKH sessions đã escalate + gửi greeting Slack |

## Bảo Mật Production

> ⚠️ Cần đổi trước khi deploy:
> - `N8N_BASIC_AUTH_PASSWORD`
> - `HR_API_KEY` (trong cả docker-compose và `.env` API)
> - `PGADMIN_DEFAULT_PASSWORD`
> - `POSTGRES_PASSWORD`
> - `SLACK_BOT_TOKEN` + `SLACK_APP_TOKEN`

---

*Liên kết:* [[00 - Tổng Quan Dự Án]] | [[05 - Database Schema (Prisma)]] | [[06 - n8n Workflows & AI Agents]] | [[30 - Business Logic & ADR Alignment (Verified 17-10-2026)]]