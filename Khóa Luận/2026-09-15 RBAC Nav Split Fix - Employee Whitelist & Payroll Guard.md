# RBAC Nav Split Fix — Employee Whitelist & Payroll API Guard

**Ngày:** 2026-09-15  
**Trạng thái:** ✅ Hoàn thành + Đã test API E2E pass 100%

---

## Vấn đề

Kiểm tra việc chia giao diện theo role phát hiện **EMPLOYEE đang thấy thừa 3 tab quản lý** ở Web Portal:

1. **Bảng Lương & Thuế** — màn quản lý lương **toàn công ty** (bảng lương tất cả nhân viên, chạy Rule Engine, duyệt/chi trả hàng loạt, cấu hình lương, xuất CSV). Nhân viên login xong còn bị rơi thẳng vào tab này (landing = tab đầu tiên còn lại sau filter). Phiếu lương cá nhân đã có sẵn trong Cổng ESS → tab này thuần túy thừa.
2. **AI Multi-Agents Sandbox** — hiện trong menu nhưng render guard chặn `isAdminRole` → bấm vào chỉ thấy **trang trắng** (dead tab).
3. **Tiếp Quản CSKH & PII** — console quản lý khiếu nại, không có render guard.

**Nguyên nhân gốc:** nav dùng **blacklist** `EMPLOYEE_HIDDEN` (chỉ ẩn 4 tab) — mọi tab quản lý thêm sau này đều mặc định lộ vào UI employee.

**Nghiêm trọng hơn — backend bị bỏ sót guard:** `PayrollController` chỉ có `JwtAuthGuard`, **không có `RolesGuard`/`@Roles`** trong khi `employees`, `settings`, `salary-config`, `agents/portal` đều đã có `@Roles('ADMIN_GROUP')`. JWT của EMPLOYEE gọi thẳng được:

- `GET /api/v1/payroll` — bảng lương **toàn bộ công ty** 🔴
- `POST /payroll/generate-bulk`, `approve-bulk`, `paid-bulk` — chạy/duyệt/chi trả lương 🔴

---

## Giải pháp

### 1. UI — Blacklist → Whitelist (`apps/web/app/page.tsx`)

```tsx
// CŨ (blacklist — dễ sót):
const EMPLOYEE_HIDDEN = new Set(["dashboard", "employees", "settings", "training-analytics"])

// MỚI (whitelist — employee chỉ được đúng 2 tab):
const EMPLOYEE_TABS: Set<NavigationTab> = new Set(["employee-portal", "my-training"])
```

- `navItems` filter: `ALL_NAV_ITEMS.filter((i) => EMPLOYEE_TABS.has(i.id))` cho EMPLOYEE.
- **Render guard lớp 2** bổ sung cho `payroll` và `cskh-escalation`: `isAdminRole(user.role) && <PayrollView />` — trước đây 2 tab này render tự do.
- **Landing mặc định theo role:** `useState(user?.role === "EMPLOYEE" ? "employee-portal" : "dashboard")` — nhân viên không còn bị ném vào màn quản lý lương khi login.

### 2. Backend — `RolesGuard + @Roles('ADMIN_GROUP')` cho Payroll

`apps/api/src/payroll/payroll.controller.ts` — 10 route quản lý đều được gắn guard (pattern giống `employees.controller.ts`):

| Route | Guard |
|---|---|
| `GET /payroll` (findAll) | ✅ ADMIN_GROUP |
| `GET /payroll/:id` | ✅ ADMIN_GROUP |
| `GET /payroll/employee/:employeeId` | ✅ ADMIN_GROUP |
| `GET /payroll/preview/:employeeId` | ✅ ADMIN_GROUP |
| `POST /payroll/generate/:employeeId` | ✅ ADMIN_GROUP |
| `POST /payroll/generate-bulk` | ✅ ADMIN_GROUP |
| `POST /payroll/approve-bulk` | ✅ ADMIN_GROUP |
| `POST /payroll/paid-bulk` | ✅ ADMIN_GROUP |
| `PATCH /payroll/:id/approve` | ✅ ADMIN_GROUP |
| `PATCH /payroll/:id/paid` | ✅ ADMIN_GROUP |
| **`GET /payroll/me`** (phiếu lương cá nhân cho ESS) | **Giữ nguyên — chỉ JwtAuthGuard** |

`apps/api/src/payroll/payroll.module.ts` — thêm `imports: [PrismaModule, AuthModule]` để `RolesGuard` resolve được `Reflector` (giống `EmployeesModule`).

### 3. Fix phụ (kèm theo)

`apps/web/components/views/dashboard-view.tsx` — sửa lỗi TS có sẵn chặn typecheck toàn web: `WF_COLORS[stat.wf] ?? WF_COLORS['WF02']` vẫn `possibly undefined` → thay bằng hằng `DEFAULT_WF_COLOR = WF_COLORS.WF02!`.

---

## Files đã thay đổi

| File | Thay đổi |
|---|---|
| `apps/web/app/page.tsx` | Whitelist `EMPLOYEE_TABS`, render guard payroll/cskh, landing theo role |
| `apps/api/src/payroll/payroll.controller.ts` | `RolesGuard` + `@Roles('ADMIN_GROUP')` cho 10 route quản lý |
| `apps/api/src/payroll/payroll.module.ts` | Import `AuthModule` (cấp `Reflector` cho RolesGuard) |
| `apps/web/components/views/dashboard-view.tsx` | Fix lỗi TS `color` possibly undefined (có sẵn từ trước) |

---

## Kiểm thử (E2E trên server thật)

**Typecheck:** `pnpm --filter api check-types` ✅ · `pnpm --filter web check-types` ✅

**API E2E** (login thật, JWT thật, DB seed có 29 bản ghi lương):

| Thử nghiệm | Kết quả |
|---|---|
| EMPLOYEE `GET /payroll` | ✅ 403 Forbidden (trước đây: 200 — lộ lương toàn công ty) |
| EMPLOYEE `POST /payroll/generate-bulk` | ✅ 403 Forbidden |
| EMPLOYEE `POST /payroll/approve-bulk` | ✅ 403 Forbidden |
| EMPLOYEE `GET /payroll/employee/:id` | ✅ 403 Forbidden |
| EMPLOYEE `GET /payroll/me` | ✅ 200 OK — ESS xem phiếu lương cá nhân bình thường |
| ADMIN `GET /payroll` | ✅ 200 OK (29 bản ghi) — admin không bị ảnh hưởng |

**UI (kiểm tra bằng mắt tại `http://localhost:3000`):** EMPLOYEE (`employee1@company.com`) chỉ thấy 2 icon ESS + Kết Quả Đào Tạo, landing vào ESS; ADMIN (`hr-admin@company.com`) thấy đủ 8 tab như cũ.

**Mobile:** không gọi endpoint payroll nào → không bị ảnh hưởng.

---

## Ghi chú & việc tiếp theo

- ⚠️ **Cập nhật bảng RBAC trong note cũ** `2026-09-15 2-Role Refactor & OAuth Account Management.md`: dòng "Bảng Lương & Thuế / AI Multi-Agents / Tiếp Quản CSKH = ✅ EMPLOYEE" **không còn đúng** — từ nay EMPLOYEE chỉ có ESS + Kết Quả Đào Tạo (đúng định hướng "EMPLOYEE → 2 tabs" của nhật ký 09-09).
- 🔍 **Phát hiện thêm, chưa sửa (hẹn lần sau):** `EmployeesController` mới chỉ guard riêng `PATCH :id/account` — `POST /employees` (tạo nhân viên) và `GET /employees` (danh sách) vẫn chỉ `JwtAuthGuard`; `DashboardController` cũng chỉ `JwtAuthGuard`.
- 🧱 **Ranh giới sandbox DSH:** `next dev`/`next build` bị chặn `spawn EPERM` khi chạy trong DSH (Next spawn jest-worker với piped stdio) — phải chạy build/start với `danger-full-access` hoặc chạy ngoài terminal thường.
