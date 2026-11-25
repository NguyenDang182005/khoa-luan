---
tags: [khoa-luan, overview, multi-agent, nestjs, nextjs]
created: 2026-09-04
updated: 2026-10-16
---

# 🎓 Khóa Luận Tốt Nghiệp — Hệ Thống Quản Trị Doanh Nghiệp Đa Tác Tử AI

## 📋 Thông Tin Chung

| Mục | Nội dung |
|-----|----------|
| **Đề tài** | Xây dựng Hệ thống Quản trị Doanh nghiệp ứng dụng Kiến trúc Đa tác tử AI (Multi-Agent System) |
| **Nghiệp vụ** | Nhân sự (HR), Đào tạo (Training), Chăm sóc khách hàng (CSKH) |
| **Loại sản phẩm** | SaaS — Phần mềm quản trị doanh nghiệp |
| **Kiến trúc repo** | Monorepo (Turborepo + pnpm) |
| **Ngôn ngữ** | TypeScript (100% end-to-end type safety) |

---

## 🧩 Bài Toán & Vấn Đề

### Pain points hiện tại tại doanh nghiệp:

- **HR:** Đối soát chấm công/lương hay sai sót; chuyên viên HR tốn thời gian giải đáp câu hỏi lặp lại
- **Đào tạo:** Onboarding tốn công quản lý, thiếu cá nhân hóa; bài test trắc nghiệm không đánh giá kỹ năng thực chiến
- **CSKH:** Áp lực trực 24/7 cho FAQ cơ bản; khó đảm bảo tính liên tục

### Hạn chế Chatbot AI truyền thống:
- Hallucination khi xử lý luật logic cứng nhắc
- Rủi ro lộ lọt dữ liệu nhạy cảm
- Kiến trúc monolithic → một AI ôm đồm → kém chính xác

---

## 🎯 Mục Tiêu

> Nghiên cứu và xây dựng SaaS quản trị doanh nghiệp tích hợp **Multi-Agent System** — phân chia cho các "Nhân viên ảo" chuyên trách, đảm bảo:
> - **Chính xác tuyệt đối** cho dữ liệu tài chính (lương, thưởng) → dùng Rule Engine
> - **Linh hoạt, tự nhiên** trong giao tiếp ngôn ngữ tự nhiên → dùng LLM

> **⚖️ Scope 25/09:** Phase 1 = **Web-only** (Web Portal Admin + ESS + Zalo OA). Mobile App đã cắt khỏi scope — hướng phát triển. Xem [[23 - Quyết Định Web-Only Phase 1 (Cắt Mobile App)]].

---

## 📂 Cấu Trúc Repo

```
khoa-luan/ (Turborepo Monorepo)
├── apps/
│   ├── api/          # NestJS Backend (port 3001) — 18 modules
│   └── web/          # Next.js Web Portal (port 3000) — 10 views
├── packages/
│   ├── database/     # Prisma schema + migrations (PostgreSQL) — 22 models, 14 enums
│   ├── shared-types/ # Types dùng chung FE ↔ BE (build tsc → dist/)
│   ├── eslint-config/
│   └── typescript-config/
├── n8n-workflows/    # 5 workflow JSON cho n8n (WF01-04 + Slack verify)
├── scripts/          # 50+ tool vận hành: audit, debug n8n, e2e test, fix data
├── docs/adr/          # 3 Architecture Decision Records
└── docker-compose.yml
```

> **Cập nhật 14/10:** xoá `apps/docs` + `packages/ui` (dead workspace); `shared-types` build ra `dist/` (Node 24 không load raw .ts qua ESM). Chi tiết: [[26 - Nhật Ký Ngày 14-10-2026 (Audit 20 Lỗi & Debug n8n Live)]].

---

## 🔗 Liên Kết Nội Bộ

### Tài liệu Kiến Trúc
- [[01 - Kiến Trúc Hệ Thống & Multi-Agent]]
- [[02 - Backend NestJS (API)]]
- [[03 - Web Portal (Next.js)]]
- [[04 - Mobile App (React Native)]] *(hướng phát triển)*
- [[05 - Database Schema (Prisma)]]
- [[06 - n8n Workflows & AI Agents]]
- [[07 - Kế Hoạch Thực Hiện 15 Tuần]]
- [[08 - Infrastructure & DevOps]]

### Quản lý & Kế hoạch
- [[09 - Task Checklist]]
- [[11 - Định Hướng Phát Triển Sản Phẩm (Web & Mobile)]]
- [[23 - Quyết Định Web-Only Phase 1 (Cắt Mobile App)]]

### Audit & Cơ chế
- [[24 - Audit Cơ Chế Chấm Điểm AI]]
- [[25 - Cơ Chế OAuth Whitelist & Liên Kết Hồ Sơ Nhân Viên]]

### Nhật Ký Ngày 14/10/2026
- [[26 - Nhật Ký Ngày 14-10-2026 (Audit 20 Lỗi & Debug n8n Live)]]
- [[27 - Nhật Ký Ngày 14-10-2026 (Tối Ưu UI-UX, Bỏ Phép Thâm Niên & Chuẩn Hóa Context WF01-WF04)]]
- [[28 - Nhật Ký Ngày 14-10-2026 (Xóa Toàn Bộ Cơ Chế Cộng Thêm Ngày Phép & Đồng Bộ Context WF02-WF03)]]


### Logic Verified (17/10/2026)
- [[29 - Snapshot Toàn Hệ Thống 16-10-2026]]
- [[30 - Business Logic & ADR Alignment (Verified 17-10-2026)]]

- [[39 - Kiểm Toán & Sửa Lỗi Toàn Bộ Logic Backend API (05-11-2026)]]
