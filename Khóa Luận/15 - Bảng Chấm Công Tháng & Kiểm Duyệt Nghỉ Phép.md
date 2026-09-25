---
tags: [khoa-luan, ui-component, monthly-timesheet, leave-approval, employee-portal, desk-calendar, api-fix, status-completed]
created: 2026-09-23
updated: 2026-09-23
status: completed
---

# 🗓️ Bảng Chấm Công Tháng & Kiểm Duyệt Nghỉ Phép

> **Ngày hoàn thành:** 23/09/2026  
> **Kiểm thử:** ✅ API OK, TypeScript 0 errors, Build OK

---

## Tổng Quan

Triển khai 2 tính năng chính:

1. **Bảng Chấm Công Tháng kiểu Cuốn Lịch** — Thiết kế lại hoàn toàn component `MonthlyTimesheetStrip` trong bàn làm việc nhân viên.
2. **Kiểm Duyệt Nghỉ Phép** — Sub-tab mới trong phân hệ Quản lý Nhân Sự + component `LeaveDetailModal`.

---

## 1. Lịch Chấm Công Tháng (`MonthlyTimesheetStrip`)

### Thiết kế
Giao diện **Full-Month Calendar Grid** dạng cuốn lịch để bàn (Tear-off Desk Calendar).

```
T2    T3    T4    T5    T6    T7    CN
┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐
│T2  │ │T3  │ │T4  │ │T5  │ │T6  │ │T7  │ │CN  │  ← Ribbon màu
├···┤ ├···┤ ├···┤ ├···┤ ├···┤ ├···┤ ├···┤  ← Perforation
│ 01 │ │ 02 │ │ 03 │ │ 04 │ │ 05 │ │ 06 │ │ 07 │  ← Số ngày to
│    │ │    │ │    │ │    │ │    │ │    │ │    │  ← Giờ check-in
├───┤ ├───┤ ├───┤ ├───┤ ├───┤ ├───┤ ├───┤
│[1.0]│ │[1.0]│ │[1.0]│ │[1.0]│ │[ V ]│ │[Ngh]│ │[Ngh]│  ← Badge công
└───┘ └───┘ └───┘ └───┘ └───┘ └───┘ └───┘
```

### Quy tắc màu ribbon
| Thứ | Màu |
|---|---|
| T2 – T6 | `bg-slate-700` (tối trung tính) |
| T7 | `bg-amber-600` (cam) |
| Chủ Nhật | `bg-rose-600` (đỏ) |
| Hôm nay | `bg-primary` (màu chủ đạo xanh lá) + scale-[1.03] |

### Badge số công
| Trạng thái | Badge | Màu |
|---|---|---|
| PRESENT / REMOTE / LATE / ON_LEAVE | `1.0` | Emerald |
| HALF_DAY | `0.5` | Amber |
| ON_LEAVE | `P` | Teal |
| ABSENT / không có record | `V` | Rose |
| Cuối tuần | `Nghỉ` | Slate nhạt |
| Ngày tương lai | `···` | Mờ |

### Tương tác
- **Click ngày** → Detail Panel slide-up từ dưới:
  - Header: ribbon màu, số ngày to, tên thứ
  - Grid 2x2: Giờ Vào / Giờ Ra / Tổng Giờ / OT
  - Địa điểm GPS (nếu có)
  - Cảnh ngày cuối tuần / tương lai / vắng
- **Chuyển tháng**: nút `<` / `>` ở top bar
- **KPI tóm tắt**: Tổng công / Muộn / Vắng (top bar phải)

### File
`apps/web/components/portal/monthly-timesheet-strip.tsx`

---

## 2. Kiểm Duyệt Nghỉ Phép

### `LeaveDetailModal` (`apps/web/components/employees/leave-detail-modal.tsx`)
- Popup chi tiết đơn nghỉ phép:
  - Avatar + họ tên + mã nhân viên
  - Thông tin đơn: loại phép, ngày bắt đầu/kết thúc (DD/MM/YYYY), số ngày
  - Số dư phép còn lại (gọi `leaveApi.getBalance`)
  - Lý do
  - Nút **Duyệt** (emerald) + **Từ Chối** (rose)

### `LeaveApprovalsTab` (`apps/web/components/employees/leave-approvals-tab.tsx`)
- Sub-tab mới trong `employees-view.tsx` (tab "Kiểm Duyệt Nghỉ Phép")
- Bảng danh sách đơn PENDING: họ tên, loại, ngày, số ngày, trạng thái
- Nút "Xem & Duyệt" mở `LeaveDetailModal`

### Dashboard Integration
- `dashboard-view.tsx`: bảng chờ phép cũ có thêm nút "Xem & Duyệt" mở `LeaveDetailModal`

---

## 3. Sửa Lỗi API Schema

| File | Lỗi | Fix |
|---|---|---|
| `leave.schema.ts` | `LeaveBalanceSchema` parse fail (field name không khớp) | `.transform()` chấp nhận `total/used/remaining` và `totalDays/usedDays/remainingDays` |
| `payroll.service.ts` | `findMyPayroll` thiếu include employee | Thêm `include: { employee: { id, fullName, employeeCode, department, position } }` |
| `payroll.schema.ts` | `employee` bắt buộc | `.optional().nullable()` |
| `dashboard.schema.ts` | `PendingLeaveSchema` thiếu `employee.id` | `id: z.string().optional()` |
| `payroll.api.ts` | `p.employee.X` không an toàn | Optional chaining `p.employee?.X ?? ''` |
| `payroll-view.tsx` | `item.employee.X` không an toàn | Optional chaining `item.employee?.X ?? '--'` |

---

## 4. Kết Quả Kiểm Thử

```
[OK] Leave Balance: Total=12, Used=0, Remaining=12
[OK] Payroll Me: EMP006, Net=6.2M VND, Status=DRAFT, employee đầy đủ
[OK] Attendance T9: 7 records (ngày 1-9/09)
[OK] Pending Leaves: 3 đơn (ANNUAL, SICK, EMERGENCY)
[OK] Leave Approve: OK → Status = APPROVED
[OK] Payroll List T9: 29 records
[OK] Employees: 30 total
[OK] pnpm --filter api build → Exit 0
[OK] pnpm --filter web build → Exit 0, TypeScript 0 errors
```

---

*Liên kết:* [[03 - Web Portal (Next.js)]] | [[19 - Nhật Ký Ngày 23-09-2026]]


---

## Cập Nhật Lần 2 (23/09/2026 — buổi sáng muộn)

### 5. Thiết Kế Lại Lần 3 — Mini Calendar kiểu Apple/Google Calendar

**Vấn đề thiết kế cũ:** Ribbon dày, ô 88px quá to, border-t-[3px] đỏ nặng, trông thô.

**Thiết kế mới — Compact Mini Calendar:**
- Card nhỏ `w-[400px]`, gọng hệt Apple Calendar / Google Calendar
- Tiêu đề `Tháng 9, 2026` bold + nút nav `<` `>` gọn
- Stats bar: `● 5 Đủ · ● 2 Muộn · ● 18 Vắng` (3 dot pills nhỏ)
- Weekday header 1 hàng duy nhất (không lặp trong từng ô)
- Mỗi ô ngày: chỉ số + 1 chấm màu nhỏ bên dưới — không badge lớn
- Hôm nay: circle filled `bg-foreground text-background` (tối, như Google Cal)
- Ngày tháng khác: `opacity-25` mờ
- Click ngày → Popover (shadcn/base-ui) đầy đủ thông tin: giờ vào/ra, tổng giờ, OT, GPS
- Không có modal fullscreen nữa

**Lỗi kỹ thuật đã gặp đầu tiên:**
- `PopoverTrigger asChild` không hoạt động với `@base-ui/react` (không support `asChild` prop)
- Fix: bỏ `asChild`, để `PopoverTrigger` render trực tiếp là button của base-ui + truyền `className` vào

**Chiều rộng calendar:**
- Ban đầu dùng `max-w-[340px]` → không rộng ra được vì chỉ là giới hạn trên
- Fix: đổi thành `w-[400px]` cố định → đúng ý

### 6. Thiết Kế Layout Bàn Làm Việc (`employee-portal-view.tsx`)

**Yêu cầu từ user:** Đưa lịch + đơn nghỉ phép + lộ trình hội nhập vào cùng 1 hàng, 2 card bên phải song song nhau.

**Layout mới:**
```
flex flex-row (lg+) / flex-col (mobile)
│
├─ DIV shrink-0 flex flex-col (calendar, w-[400px])
│   └─ MonthlyTimesheetStrip (h-full, flex flex-col)
│
└─ DIV grid grid-cols-2 gap-4 flex-1 items-stretch
    ├─ Card (Đơn Nghỉ Phép, h-full)
    └─ Card (Lộ Trình Hội Nhập, h-full)
```

**Kỹ thuật stretch chiều cao đồng đều:**
| Element | Class đã thêm |
|---|---|
| Flex row ngoài | `items-stretch` |
| Calendar wrapper | `flex flex-col` |
| Calendar root div | `h-full flex flex-col` |
| Calendar grid | `flex-1 content-start` |
| Grid bên phải | `items-stretch` |
| Cả 2 card | `h-full` |

### 7. Packages Đã Cài Thêm
```bash
pnpm dlx shadcn@latest add tooltip popover
# → Tạo ra: components/ui/tooltip.tsx, components/ui/popover.tsx
# Sử dụng @base-ui/react (không phải @radix-ui)
```

### 8. Kết Quả Build
| Lần | Kết quả |
|---|---|
| Build 1 (sau install shadcn) | ❌ TS error: `asChild` không tồn tại trên PopoverTrigger |
| Build 2 (sau fix asChild) | ✅ Exit 0, 0 errors |
| Build 3 (compact design) | ✅ Exit 0, 0 errors |
| Build 4 (flex row layout) | ✅ Exit 0, 0 errors |
| Build 5 (grid-cols-2) | ✅ Exit 0, 0 errors |
| Build 6 (items-stretch + h-full) | ✅ Exit 0, 0 errors |
