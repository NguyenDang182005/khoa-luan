# Hệ Thống Quản Trị Nhân Sự Tích Hợp AI Multi-Agent

> **Đồ án Khóa Luận Tốt Nghiệp**  
> Kiến trúc Monorepo hiện đại kết hợp NestJS 11, PostgreSQL, Prisma, Next.js, React Native và Hệ thống AI Multi-Agent điều phối qua n8n & Google Gemini 3.5 Flash.

---

## 🏛️ Kiến Trúc Hệ Thống (System Architecture)

```
┌───────────────────────────────────────────────────────────┐
│                     Client Apps Layer                     │
│  - Web Portal (Next.js 14, Tailwind CSS, shadcn/ui)       │
│  - Mobile App (React Native, Expo, NativeWind)            │
│  - Zalo OA / Chatbot Interface                            │
└──────────────┬─────────────────────────────┬──────────────┘
               │                             │
               ▼ HTTP / WebSocket            ▼ Webhook
┌──────────────────────────────┐    ┌──────────────────────────┐
│        NestJS Backend        │    │    n8n Multi-Agent Flow   │
│   (Port 3001 - Fastify/Rest) │◄──►│ (Port 5678 - AI Engine)  │
│  - Auth (JWT, RBAC)          │x-  │  - WF01: Router Agent    │
│  - Employees, Attendance     │api-│  - WF02: HR Q&A Agent    │
│  - Payroll, Contracts, Leave │key │  - WF03: Training Agent  │
│  - AI Context & Session Mgmt │    │  - WF04: Zalo CSKH Agent │
└──────────────┬───────────────┘    └────────────┬─────────────┘
               │                                 │
               ▼ Prisma ORM                      ▼ Gemini API
┌──────────────────────────────┐    ┌──────────────────────────┐
│     PostgreSQL 16 Database   │    │ Google Gemini 3.5 Flash  │
│ (Port 5432 - Schema public)  │    │  (Generative AI Model)   │
└──────────────────────────────┘    └──────────────────────────┘
```

---

## 📦 Cấu Trúc Monorepo (Turborepo)

```tree
khoa-luan/
├── apps/
│   ├── api/                 # NestJS 11 API Backend (Port 3001)
│   ├── web/                 # Next.js HR Web Portal (Port 3000)
│   └── mobile/              # React Native Mobile App (Expo)
├── packages/
│   ├── database/            # Prisma Schema, Migrations & Database Client
│   ├── shared-types/        # TypeScript interfaces dùng chung (Auth, Employee, HR)
│   └── typescript-config/   # Base tsconfig cho NestJS & React Native
├── n8n-workflows/           # 4 AI Multi-Agent Workflows (JSON exports)
│   ├── 01-router-agent.json
│   ├── 02-hr-qa-agent.json
│   ├── 03-training-agent.json
│   └── 04-zalo-cskh.json
├── docs/                    # Architecture Decision Records (ADR)
├── Khóa Luận/               # Toàn bộ tài liệu báo cáo & nhật ký đồng bộ Obsidian
├── scripts/                 # Automation & E2E Test scripts
├── docker-compose.yml       # Khởi tạo Postgres 16, pgAdmin 4, n8n (ignored)
└── docker-compose.example.yml # Template cấu hình Docker
```

---

## 🚀 Hướng Dẫn Khởi Chạy (Quickstart)

### 1. Yêu cầu hệ thống
- **Node.js**: `>= 20.x`
- **pnpm**: `>= 9.x`
- **Docker Desktop**

### 2. Cài đặt Dependencies
```bash
pnpm install
```

### 3. Cấu hình Môi trường & Khởi động Docker Services
Sao chép template và điền thông tin khóa API:
```bash
cp docker-compose.example.yml docker-compose.yml
cp apps/api/.env.example apps/api/.env
cp packages/database/.env.example packages/database/.env
```
Cập nhật `GEMINI_API_KEY` và `HR_API_KEY` vào `docker-compose.yml` và `apps/api/.env`.

Khởi động các dịch vụ qua Docker:
```bash
docker compose up -d
```
- **PostgreSQL**: `localhost:5432`
- **pgAdmin**: `http://localhost:5050`
- **n8n Workflow**: `http://localhost:5678`

### 4. Database Migration & Seed
```bash
cd packages/database
npx prisma migrate dev
pnpm run db:seed
```

### 5. Khởi chạy Backend API
```bash
cd ../../apps/api
pnpm run start:dev
```
Backend API sẽ chạy tại: `http://localhost:3001/api/v1`

---

## 🤖 Hệ Thống AI Multi-Agent (n8n Workflows)

1. **WF01 - Router Agent**: Tiếp nhận tin nhắn người dùng, phân loại ý định (HR Q&A, Đào tạo Onboarding, CSKH) và điều hướng. Tích hợp nạp ngữ cảnh nhân viên (profile, hợp đồng, chấm công, phép năm) từ NestJS.
2. **WF02 - HR Q&A Agent**: Trả lời chính sách, thủ tục nhân sự dựa trên kiến thức doanh nghiệp và dữ liệu cá nhân hóa.
3. **WF03 - Training & Onboarding Agent**: Đào tạo nhân viên mới qua kịch bản tương tác 2 chiều, trắc nghiệm nội quy và đánh giá xử lý tình huống thực tế bằng AI.
4. **WF04 - Zalo CSKH Agent**: Tương tác đa kênh qua Zalo Official Account, hỗ trợ ứng viên & nhân viên.

---

## 🛡️ Bảo Mật & Quản Lý Phiên (Session Management)
- **Cơ chế Reset phiên On-demand**: Tự động đánh dấu hết hạn phiên chat sau 00:00 hàng ngày (giờ Việt Nam). Nhân viên nhắn tin ngày mới sẽ tự động nhận phiên làm việc mới sạch ngữ cảnh.
- **Escalate to Human**: Chuyển giao thông minh cho HR khi gặp câu hỏi nhạy cảm hoặc vượt thẩm quyền AI.
- **Bảo vệ Secret Keys**: Mọi token và API Key được cô lập qua `.env` và `docker-compose.override.yml`, không đẩy lên Git.
