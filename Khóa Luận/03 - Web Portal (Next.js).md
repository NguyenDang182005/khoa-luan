---
tags: [khoa-luan, frontend, nextjs, web, admin-portal]
created: 2026-09-04
---

# 🏠 Web Portal Admin (Next.js)

## Thông Tin

| Mục | Giá trị |
|-----|----------|
| **Framework** | Next.js 16.3 (React 19) |
| **Port** | 3000 |
| **Path** | `apps/web/` |
| **Styling** | Tailwind CSS v4 |
| **Components** | shadcn/ui + Base UI |
| **State** | Zustand + TanStack Query |
| **Forms** | React Hook Form + Zod |
| **Charts** | Recharts |

## Mục Đích

Bảng điều khiển dành cho **Admin / HR Manager** với không gian màn hình rộng:

- 📊 **Dashboard tổng quan**: Thống kê nhân sự, chấm công, lương
- 👥 **Quản lý nhân viên**: CRUD nhân viên, phòng ban, hợp đồng
- 💰 **Cài công thức lương**: Cấu hình SalaryConfig (BHXH, BHYT, OT rate...)
- 🔔 **Thông báo real-time** (WebSocket): Nhận cảnh báo khiếu nại CSKH
- 🗨️ **Tiếp quản hội thoại**: Admin tiếp nhận thử công từ AI
- 📅 **Báo cáo chấm công, nghỉ phép, payroll**

## Dependencies Chính

| Package | Mục đích |
|---------|----------|
| `next` 16.3 | Full-stack React framework |
| `react` 19 | UI runtime |
| `tailwindcss` v4 | Utility-first CSS |
| `@tanstack/react-query` | Server state + caching |
| `@tanstack/react-table` | Data tables |
| `react-hook-form` + `zod` | Form validation |
| `recharts` | Biểu đồ báo cáo |
| `zustand` | Client-side global state |
| `sonner` | Toast notifications |
| `axios` | HTTP client |
| `@repo/shared-types` | End-to-end type safety với BE |

---

*Liên kết:* [[00 - Tổng Quan Dự Án]] | [[02 - Backend NestJS (API)]] | [[11 - Định Hướng Phát Triển Sản Phẩm (Web & Mobile)]]
