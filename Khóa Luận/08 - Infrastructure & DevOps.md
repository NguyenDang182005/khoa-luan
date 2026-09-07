---
tags: [khoa-luan, devops, docker, infrastructure]
created: 2026-09-04
---

# 🐳 Infrastructure & DevOps

## Docker Compose Services

File: `docker-compose.yml` — chạy 3 service bằng `docker-compose up -d`

| Service | Image | Port | Mục đích |
|---------|-------|------|----------|
| `postgres` | postgres:16-alpine | 5432 | Database chính |
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

## Shared Packages

| Package | Export |
|---------|--------|
| `@repo/database` | PrismaClient, models |
| `@repo/shared-types` | TypeScript types FE ↔ BE |
| `@repo/ui` | React component library |
| `@repo/eslint-config` | ESLint rules |
| `@repo/typescript-config` | tsconfig bases |

## Bảo Mật Production

> ⚠️ Cần đổi trước khi deploy:
> - `N8N_BASIC_AUTH_PASSWORD`
> - `HR_API_KEY` (trong cả docker-compose và `.env` API)
> - `PGADMIN_DEFAULT_PASSWORD`
> - `POSTGRES_PASSWORD`

---

*Liên kết:* [[00 - Tổng Quan Dự Án]] | [[05 - Database Schema (Prisma)]] | [[06 - n8n Workflows & AI Agents]]
