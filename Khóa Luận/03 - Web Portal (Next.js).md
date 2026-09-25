---
tags: [khoa-luan, frontend, nextjs, web, admin-portal, status-completed]
created: 2026-09-04
updated: 2026-09-23
status: completed
---

# 🏠 Web Portal Enterprise (Next.js 16 + shadcn/ui)

## 📌 Thông Tin Kỹ Thuật

| Mục | Giá trị |
|---|---|
| **Framework** | Next.js 16.3 (React 19, Turbopack) |
| **Port** | **3000** (`http://localhost:3000`) |
| **Path** | `apps/web/` |
| **Styling** | Tailwind CSS v4 (`@theme inline`, OKLCH Color Palette) |
| **UI Components** | shadcn/ui (style `base-nova` trên nền `@base-ui/react`) |
| **Charts** | Recharts (AreaChart, PieChart, RadarChart) |
| **Data Tables** | TanStack Table v8 |
| **State & Forms** | Zustand + React Hook Form + Zod |
| **Type Safety** | `@repo/shared-types` |
| **Trạng thái** | ✅ **Đã hoàn thiện & Kiểm thử đạt 100%** |

---

## 🏛️ Bố Cục Điều Hướng 4 Tầng (Multi-tier Enterprise Shell)

1. **Top Shell Header (`h-14`):** Brand Logo, Global Search `⌘K`, trạng thái API/n8n, chuyển vai trò Admin↔ESS, WebSocket bell.
2. **Left Icon Rail (`w-16`):** 7 phân hệ icon-only.
3. **Contextual Sub-Sidebar (`w-64`):** danh mục con động.
4. **Main Workspace Canvas:** bảng biểu, chart, chat AI.
5. **Right Inspector Drawer (`w-72`):** ngữ cảnh agent, độ trễ, hồ sơ.

---

## 🚀 7 Phân Hệ Nghiệp Vụ Hoàn Chỉnh

### 1. 📊 Dashboard Điều Hành (`dashboard-view.tsx`)
- 4 KPI thật, AreaChart 30 ngày, PieChart phòng ban, Feed n8n real-time.
- **[23/09]** Click đơn nghỉ phép → `LeaveDetailModal` popup: thông tin đầy đủ + Approve/Reject.

### 2. 👥 Quản Lý Nhân Sự (`employees-view.tsx`)
- TanStack Data Table, drawer 5 nhóm thông tin.
- **[23/09] 3 sub-tab mới:**
  - `Danh Sách Nhân Sự` — bảng chính
  - `Kiểm Duyệt Nghỉ Phép` (`leave-approvals-tab.tsx`) — bảng đơn PENDING, `LeaveDetailModal` approve/reject inline
  - `Lộ Trình Hội Nhập` (`onboarding-management-tab.tsx`)
- **[23/09] `LeaveDetailModal`** component mới: nhân viên, số dư phép, lý do, ngày DD/MM/YYYY.

### 3. 💰 Bảng Lương (`payroll-view.tsx`)
- Gross-to-Net tự động, Rule Engine, duyệt hàng loạt bulk.
- **[25/09] Redesign Toolbar 2-Tier:** Tách biệt Header trang (Cài Đặt Quy Chế, Xuất CSV, Chạy Rule Engine) và Thanh Công Cụ Toolbar Card hiện đại (Bộ chọn kỳ Tháng/Năm có Chevron, Badge trạng thái kỳ, cụm nút Duyệt/Chi trả hàng loạt linh hoạt).

### 4. 🤖 AI Multi-Agents (`ai-agents-view.tsx`)
- WF01 Router Gateway Hub (3 tab: Sandbox PII, Security Pipeline, Live Audit Trail).
- WF04 Zalo CSKH & Escalation Agent được khôi phục.

### 5. 🚨 Tiếp Quản CSKH (`cskh-escalation-view.tsx`)
- Banner WebSocket cảnh báo, split chat, PII Audit Trail.

### 6. 📈 Đào Tạo & Radar AI (`training-analytics-view.tsx`)
- Spider Chart 4 cánh, Hybrid Assessment (trắcnghiệm + tự luận AI), bảng xếp hạng.

### 7. 👤 Cổng Nhân Viên ESS (`employee-portal-view.tsx`)
- Check-in/out GPS 200m, widget phép năm, nộp đơn nghỉ, phiếu lương Accordion.
- **Floating HR AI Assistant** 24/7.
- **[23/09] `MonthlyTimesheetStrip` → Lịch Chấm Công Tháng kiểu Cuốn Lịch:**
  - Full-month grid 7 cột (T2 → CN) hiển thị cả tháng.
  - Mỗi ô ngày = tờ lịch xé: ribbon màu theo thứ (slate/amber/rose/primary), đường perforated, số ngày cực to (text-2xl), badge số công (1.0/0.5/P/V), giờ check-in mini.
  - Click vào ngày → detail panel slide-up (giờ vào/ra, OT, GPS location).
  - KPI tóm tắt: Tổng công / Muộn / Vắng.

---

## 🐛 Lỗi Đã Sửa (23/09/2026)

| Vấn đề | Root Cause | Fix |
|---|---|---|
| Bàn làm việc hiện `-- / --` (phép năm) | Backend trả `{total, used, remaining}` nhưng Zod expect `{totalDays, usedDays, remainingDays}` | `.transform()` trong `LeaveBalanceSchema` chấp nhận cả 2 format |
| Không hiện phiếu lương | `findMyPayroll` không `include employee` → Zod fail | Thêm `include: { employee: {...} }` Prisma |
| TS error `employee possibly null` | `employee` bắt buộc trong schema | `.optional().nullable()` + optional chaining |
| `PendingLeaveData.employee.id` không tồn tại | Thiếu `id` trong `PendingLeaveSchema` | Thêm `id: z.string().optional()` |

---

## 🧪 Kết Quả Kiểm Thử (23/09/2026)

| API Endpoint | Kết quả |
|---|---|
| `GET /leave/balance/:id?year=2026` | ✅ `{total: 12, used: 0, remaining: 12}` |
| `GET /payroll/me?month=9&year=2026` | ✅ NetSalary 6.2M, employee EMP006 đầy đủ |
| `GET /attendance/employee/:id?month=9&year=2026` | ✅ 7 records (1–9/09) |
| `GET /dashboard/pending-leaves` | ✅ 3 đơn PENDING |
| `PATCH /leave/:id/approve` | ✅ Status → APPROVED |
| `GET /payroll?month=9&year=2026` | ✅ 29 records, 30 nhân viên |
| `pnpm --filter api build` | ✅ Exit 0 |
| `pnpm --filter web build` | ✅ Exit 0, TypeScript 0 errors |

---

*Tài liệu:* [[12 - Báo Cáo Triển Khai & Kiểm Thử Web Portal (Next.js + shadcn ui)]] | [[11 - Định Hướng Phát Triển Sản Phẩm (Web & Mobile)]] | [[19 - Nhật Ký Ngày 23-09-2026]]


## Cập Nhật (23/09/2026 — buổi sáng muộn)

### Thiết Kế Lại `MonthlyTimesheetStrip` v3 + Layout Bàn Làm Việc

**[Cập nhật 23/09 v3]** `MonthlyTimesheetStrip` (`apps/web/components/portal/monthly-timesheet-strip.tsx`) viết lại lần 3 — thiết kế compact mini calendar:
- `w-[400px]` cố định, `h-full flex flex-col` tự stretch
- Số ngày + 1 dot màu nhỏ (không badge lớn), hôm nay = circle filled dark
- Click → Popover base-ui chi tiết (giờ vào/ra/OT/GPS)
- `PopoverTrigger` không dùng `asChild` (base-ui không hỗ trợ)
- Cài thêm: `components/ui/tooltip.tsx`, `components/ui/popover.tsx`

**[Cập nhật 23/09]** `employee-portal-view.tsx` layout mới:
- Flex row 3 ô: Calendar (400px `shrink-0`) + grid-cols-2 (Đơn nghỉ + Hội nhập)
- `items-stretch` + `h-full` — 3 ô cao bằng nhau
- Build ✅ 0 errors
