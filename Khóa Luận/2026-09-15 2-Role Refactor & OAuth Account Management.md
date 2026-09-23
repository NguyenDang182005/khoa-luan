# 2-Role Refactor & Quản lý tài khoản OAuth

**Ngày:** 2026-09-15  
**Trạng thái:** ✅ Hoàn thành & kiểm thử ổn định

---

## Mục tiêu

Rút gọn hệ thống phân quyền từ 5 role (`ADMIN`, `HR_MANAGER`, `HR_ADMIN`, `MANAGER`, `EMPLOYEE`) xuống còn **2 role duy nhất**: `ADMIN` và `EMPLOYEE`. Đồng thời thêm tính năng cho ADMIN quản lý email đăng nhập và role của nhân viên (hỗ trợ OAuth Google/Facebook whitelist).

---

## Những thay đổi đã thực hiện

### 🗄️ Database

| File | Thay đổi |
|------|----------|
| `packages/database/prisma/schema.prisma` | `enum UserRole` chỉ còn `ADMIN` và `EMPLOYEE` — xóa `HR_MANAGER`, `HR_ADMIN`, `MANAGER` |
| `packages/database/prisma/seed.ts` | Đổi `hrAdminUser` → `ADMIN`; xóa `hrUser` (HR_MANAGER); fix EMP002 `userId: null` |

**Data migration (chạy trực tiếp SQL):**
```sql
UPDATE users SET role='ADMIN' WHERE role IN ('HR_MANAGER', 'HR_ADMIN');
UPDATE users SET role='EMPLOYEE' WHERE role='MANAGER';
```
Kết quả: **4 ADMIN, 30 EMPLOYEE**

Chạy schema sync:
```bash
pnpm --filter @repo/database db:push --accept-data-loss
pnpm --filter @repo/database db:seed
```

### 📦 Shared Types

**`packages/shared-types/src/auth.types.ts`**
```ts
export enum UserRole { ADMIN = 'ADMIN', EMPLOYEE = 'EMPLOYEE' }
export function isAdminRole(role: string): boolean { return role === UserRole.ADMIN }
```

### 🔧 Backend NestJS

| File | Thay đổi |
|------|----------|
| `apps/api/src/auth/guards/roles.guard.ts` | `ADMIN_ROLES = new Set(["ADMIN"])` |
| `apps/api/src/ai-context/ai-context.service.ts` | query `role: { in: ['ADMIN'] }` |
| `apps/api/src/employees/dto/create-employee.dto.ts` | Thêm `role?: string` với `@IsIn(['ADMIN', 'EMPLOYEE'])` |
| `apps/api/src/employees/employees.service.ts` | Thêm `updateAccount()`, `createActiveUser()`, sửa `create()` nhận `role` |
| `apps/api/src/employees/employees.controller.ts` | Thêm `PATCH /employees/:id/account` với `@Roles('ADMIN_GROUP')` |
| `apps/api/src/employees/employees.module.ts` | Import `AuthModule` để `RolesGuard` có `Reflector` |

**API mới:**
```
PATCH /api/v1/employees/:id/account
Body: { email?: string; role?: 'ADMIN' | 'EMPLOYEE' }
Auth: Bearer JWT, role ADMIN
```

**`findOne()` giờ trả về thêm:** `googleId`, `facebookId` trong object `user`

**Cơ chế:** `User` với `isActive: true` + real email → whitelist OAuth. Placeholder email (`email.placeholder.xxx@...`) + `isActive: false` → không thể login.

### 🌐 Frontend Next.js

| File | Thay đổi |
|------|----------|
| `apps/web/lib/auth-context.tsx` | `type UserRole = "ADMIN" \| "EMPLOYEE"` |
| `apps/web/app/page.tsx` | Nav routing chỉ còn 2 case; settings condition `user.role === "ADMIN"` |
| `apps/web/lib/api/employees.api.ts` | Thêm `UpdateAccountInput`, `updateAccount()`, `role` trong `CreateEmployeeInput` |
| `apps/web/lib/schemas/employee.schema.ts` | Thêm `googleId`, `facebookId`, `isActive` vào `user` schema |
| `apps/web/components/auth/login-view.tsx` | Quick-fill "Admin" → `hr-admin@company.com` |
| `apps/web/components/views/employees-view.tsx` | Role dropdown, OAuth icons, nút Sửa Email & Role |

**UI employees-view.tsx:**
- **Form "Thêm nhân viên"**: Dropdown Role (EMPLOYEE / ADMIN) — tạo User active nếu chọn role
- **Drawer section 5 "Trạng thái & Tài khoản"**:
  - Icon Google 🔵 / Facebook 🔷 hiện khi đã link OAuth (`googleId`/`facebookId` non-null)
  - Badge hiển thị role hiện tại
  - Nút **"Sửa Email & Role"** (chỉ ADMIN) → dialog gọi `PATCH /employees/:id/account`

---

## RBAC Navigation (từ session cùng ngày)

| Tab | ADMIN | EMPLOYEE |
|-----|-------|----------|
| Bảng Điều Hành | ✅ | ❌ |
| Hồ Sơ Nhân Sự | ✅ | ❌ |
| Bảng Lương & Thuế | ✅ | ~~✅~~ ❌ *(sửa 15-09, xem note RBAC Nav Split Fix)* |
| AI Multi-Agents | ✅ | ~~✅~~ ❌ *(sửa 15-09, xem note RBAC Nav Split Fix)* |
| Tiếp Quản CSKH | ✅ | ~~✅~~ ❌ *(sửa 15-09, xem note RBAC Nav Split Fix)* |
| Đào Tạo & Radar AI | ✅ | ❌ |
| Cổng Nhân Viên (ESS) | ✅ | ✅ |
| Kết Quả Đào Tạo | ❌ | ✅ |
| Cài Đặt Hệ Thống | ✅ | ❌ |

> **⚠️ Cập nhật 15-09-2026:** Bảng trên đã lỗi thời ở 3 dòng. Từ phiên bản "RBAC Nav Split Fix", EMPLOYEE **chỉ thấy 2 tab** (Cổng Nhân Viên ESS + Kết Quả Đào Tạo) — nav chuyển từ blacklist sang whitelist `EMPLOYEE_TABS`, đồng thời `PayrollController` được gắn `RolesGuard + @Roles('ADMIN_GROUP')`. Chi tiết: `2026-09-15 RBAC Nav Split Fix - Employee Whitelist & Payroll Guard.md`

**2 lớp bảo vệ:**
1. Sidebar: `EMPLOYEE_HIDDEN_TABS` filter → tab không hiện trong menu
2. Render guard: `user.role === "ADMIN"` → dù hack URL cũng không render component

---

## Demo credentials (sau seed)

| Role | Email | Mật khẩu |
|------|-------|----------|
| ADMIN | `hr-admin@company.com` | `Admin@123` |
| EMPLOYEE | `employee1@company.com` | `Employee@123` |
| EMPLOYEE | `employee2@company.com` | `Employee@123` |

---

## Liên kết

- [[2026-09-15 Layout Refactor - Fixed Header & Sidebar]]
- `CONTEXT.md` tại repo root đã cập nhật mô tả ADMIN
