---
tags: [khoa-luan, overview, multi-agent, nestjs, nextjs]
created: 2026-09-04
updated: 2026-09-25
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

## 🗂️ Cấu Trúc Repo

```
khoa-luan/ (Turborepo Monorepo)
├── apps/
│   ├── api/          # NestJS Backend (port 3001)
│   ├── web/          # Next.js Web Portal Admin (port 3000)
│   └── docs/         # Tài liệu Next.js
├── packages/
│   ├── database/     # Prisma schema + migrations (PostgreSQL)
│   ├── shared-types/ # Types dùng chung FE ↔ BE
│   ├── ui/           # Shared React component library
│   ├── eslint-config/
│   └── typescript-config/
├── n8n-workflows/    # 4 workflow JSON cho n8n
└── docker-compose.yml
```

---

## 🔗 Liên Kết Nội Bộ

- [[01 - Kiến Trúc Hệ Thống & Multi-Agent]]
- [[02 - Backend NestJS (API)]]
- [[03 - Web Portal (Next.js)]]
- [[04 - Mobile App (React Native)]] *(đã cắt khỏi scope 25/09 — hướng phát triển)*
- [[05 - Database Schema (Prisma)]]
- [[06 - n8n Workflows & AI Agents]]
- [[07 - Kế Hoạch Thực Hiện 15 Tuần]]
- [[08 - Infrastructure & DevOps]]
- [[11 - Định Hướng Phát Triển Sản Phẩm (Web & Mobile)]]
- [[23 - Quyết Định Web-Only Phase 1 (Cắt Mobile App)]]
