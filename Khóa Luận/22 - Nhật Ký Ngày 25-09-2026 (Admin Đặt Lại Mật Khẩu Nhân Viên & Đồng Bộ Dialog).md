---
tags: [khoa-luan, nhat-ky, auth, password-reset, admin, rbac, employees, security-policy, audit-log, ui-sync]
created: 2026-09-25
updated: 2026-09-25
---

# 📅 Nhật Ký Ngày 25-09-2026 — Admin Đặt Lại Mật Khẩu Nhân Viên & Đồng Bộ Dialog Trang Nhân Viên

> **Chủ đề chính:**
> 1. Xây tính năng **Admin đặt lại mật khẩu cho nhân viên** (`POST /employees/:id/reset-password`) — lấp khoảng trống: nhân viên quên mật khẩu trước đây không có đường hồi (mật khẩu cấp phát ban đầu là random vô nghĩa, hệ thống không có quên mật khẩu).
> 2. Đồng bộ UI các dialog hành động trong trang **Quản Lý Nhân Sự** qua helper `Field` dùng chung, bổ sung dialog Đặt Lại Mật Khẩu theo đúng bộ `components/ui` hiện có.

---

## 1. Quyết Định Thiết Kế (Quy Trình Grilling 5 Vòng) 🧭

Tính năng được định hình qua phỏng vấn thiết kế 5 vòng, mỗi quyết định đều dựa trên **sự thật đã xác minh trong code**:

| Quyết định | Chốt | Lý do |
|---|---|---|
| Ai đổi mật khẩu? | **Chỉ admin đổi hộ**, nhân viên không có bề mặt tự đổi | Trang Cài Đặt/Bảo Mật là ADMIN-only (`app/page.tsx:197`); các endpoint phiên trả phiên của tất cả user, không thể mở cho nhân viên |
| Đặt UI ở đâu? | Hành động trên **từng dòng/drawer nhân viên** trong trang Nhân Viên | Đúng workflow quản trị "tìm đúng người → reset", tái dùng pattern dialog sẵn có |
| Mật khẩu mới do ai tạo? | **Toggle "Tự sinh / Tự nhập"**, mặc định Tự sinh | Random giúp admin khỏi nghĩ ra mật khẩu yếu; vẫn nhập được mật khẩu dễ nhớ cho nhân viên lớn tuổi |
| Đối tượng được reset? | **Chỉ EMPLOYEE đang kích hoạt** | Phễu quyền hẹp — mật khẩu admin tự đổi ở Cài Đặt → Bảo Mật & Phiên |
| Khi reset thì sao? | Thu hồi **toàn bộ refresh token** của nhân viên + cập nhật `passwordChangedAt` | Mật khẩu mới ⇒ mọi phiên cũ (mọi thiết bị) phải đăng nhập lại |
| Audit? | Section mới `account`, giá trị **mask `••••••`**, không bao giờ log mật khẩu thật | Hành động nhạy cảm nhất của đợt này phải có vết truy vết |
| Rate-limit? | Bỏ qua, giữ hiện trạng | `ThrottlerModule` đã cấu hình nhưng chưa đăng ký `APP_GUARD` — ghi nhận làm việc đợt sau |

---

## 2. Triển Khai Backend (`apps/api`) ⚙️

### 2.1. Endpoint & Phễu Quyền
```http
POST /api/v1/employees/:id/reset-password
Authorization: Bearer <admin-access-token>
{ "mode": "GENERATE" }                      // hoặc { "mode": "MANUAL", "newPassword": "..." }
```
- Guard kép: `JwtAuthGuard` + `RolesGuard` với `@Roles('ADMIN_GROUP')` (`employees.controller.ts`).
- Service `resetPassword()` (`employees.service.ts`) từ chối theo thứ tự:
  1. Nhân viên không tồn tại → `404`
  2. Target role `ADMIN` → `400` *"mật khẩu ADMIN tự đổi trong Cài Đặt → Bảo Mật & Phiên"*
  3. User placeholder `isActive: false` → `400` *"dùng Sửa Email & Role để cấp tài khoản trước"*

### 2.2. Sinh Mật khẩu Đạt Chính Sách (`generatePolicyPassword`)
- Độ dài `max(12, passwordMinLength)`; dùng `crypto.randomInt` (an toàn mật mã) + **Fisher–Yates shuffle**.
- Đảm bảo mỗi nhóm ký tự bắt buộc (`requireUppercase/Lowercase/Digit/Special`) có mặt ≥1 lần, sau đó **tự kiểm tra chốt hạ** bằng `validatePasswordPolicy` — phòng cấu hình chính sách đặc biệt.
- `validatePasswordPolicy` được **tách ra util thuần** `auth/password-policy.ts` (không import NestJS/Firebase) để dùng chung và chạy được trong Jest — fix lỗi `SyntaxError: Unexpected token 'export'` khi test kéo nhầm `firebase-admin`/`jose` (ESM) vào bundle CJS.

### 2.3. Nghiệp Vụ Sau Khi Đặt Lại
- `bcrypt.hash(newPassword, 10)` (đồng nhất cost với luồng đăng nhập/change-password).
- **Một transaction** gồm: `user.update { passwordHash, passwordChangedAt }` + `refreshToken.deleteMany({ userId })` → thu hồi mọi phiên.
- **GENERATE trả plaintext đúng 1 lần** trong response (`generatedPassword`) — hệ thống không có email nên admin phải chuyển tay; MANUAL không trả mật khẩu về client.

### 2.4. Audit Log Mở Rộng
- `SettingsAuditService`: thêm type `AuditSection` (bổ sung `'account'`) và method mới **`logAction()`** — ghi 1 row tùy ý (khác `logChanges()` vốn so sánh before/after từng field).
- Row ghi: `field: 'password'`, `oldValue: '••••••'`, `newValue: 'đặt lại bởi admin — EMPxxxx (email)'` → hiển thị trong tab **Nhật Ký Thay Đổi** với nhãn mục **Tài khoản**.
- Lỗi ghi audit **không chặn nghiệp vụ** (chỉ log warning) — đúng pattern hiện hành.

---

## 3. Triển Khai Frontend (`apps/web`) 🎨

### 3.1. Dialog Đặt Lại Mật Khẩu (`employees-view.tsx`)
- Nút **"Đặt Lại Mật Khẩu"** (icon `KeyRound`) trong drawer nhân viên — **Mục 5. Trạng Thái & Tài Khoản**, cùng nhóm gate `isAdmin` với "Sửa Email & Role".
- `Switch` (ui-kit) **"Tự sinh mật khẩu ngẫu nhiên"** mặc định bật; bỏ chọn mới hiện ô nhập mật khẩu.
- Sau khi thành công (GENERATE): hộp cảnh báo viền amber hiện mật khẩu `font-mono` + nút **Sao chép** (`navigator.clipboard`, fallback chọn tay) + nhắc *"chỉ hiển thị MỘT LẦN"* — sau khi đóng dialog không xem lại được.
- Chỉ dùng `components/ui` hiện có (Dialog/Button/Input/Switch), không CSS tay, không cài thêm thư viện.

### 3.2. Đồng Bộ 3 Dialog Cũ — Helper `Field`
- Thêm helper module-level:
  ```tsx
  function Field({ label, error, children }) { ... }  // label + control + lỗi inline text-agent-coral
  ```
- Áp dụng cho **Chỉnh Sửa Hồ Sơ**, **Thêm Nhân Viên**, **Sửa Email & Role** và dialog mới — appearance giữ nguyên 100%, code bớt lặp và ép mọi dialog cùng một kiểu cấu trúc `DialogHeader → content (Field…) → DialogFooter [Hủy | nút chính]`.
- API layer: `employeesApi.resetPassword()` + `ResetPasswordResponseSchema` (zod) — đúng pattern `xxx.api.ts` của dự án.

---

## 4. Kiểm Thử ✅

### 4.1. Unit Test (7 case — `employees.service.spec.ts`)
1. **GENERATE**: mật khẩu sinh ra đạt đúng `SecurityPolicy`; hash bcrypt so khớp plaintext; có `passwordChangedAt`; `refreshToken.deleteMany` theo đúng `userId`; audit **không chứa plaintext**.
2. **MANUAL hợp lệ**: lưu đúng, so khớp bcrypt, không trả plaintext trong response.
3. **MANUAL yếu**: từ chối theo policy, không đụng `user.update`, không ghi audit.
4. **MANUAL thiếu mật khẩu**: `BadRequest`, không thay đổi gì.
5. **Target ADMIN**: từ chối.
6. **Placeholder inactive**: từ chối.
7. **Nhân viên không tồn tại**: `404`.

### 4.2. Kết Quả Tự Động
```bash
pnpm exec jest --runInBand            # Test Suites: 3 passed (28/28 tests)
pnpm exec tsc --noEmit                # apps/api — TS OK
pnpm run check-types                  # apps/web — Types generated successfully
pnpm run build                        # next build ✓ Compiled successfully
```
> Ghi chú: `pnpm run lint` (web, `--max-warnings 0`) fail với 31 warning — **tất cả tiền tồn tại** từ trước đợt này (ai-agents-view, employee-portal-view, onboarding.api, 5 `as any` cũ trong employees-view), không có warning mới được thêm.

### 4.3. Kịch Bản Thủ Công (2 Role)
1. Swagger `:3001/docs` → login admin → `POST /employees/{id}/reset-password {mode:"GENERATE"}`.
2. UI: Nhân Viên → mở drawer → Mục 5 → Đặt Lại Mật Khẩu → copy mật khẩu.
3. Đăng nhập nhân viên bằng **Email + mật khẩu mới** (không qua Google/Facebook) → thành công; các phiên cũ đã chết ngay lúc reset.
4. Cài Đặt → **Nhật Ký Thay Đổi** → dòng mục **Tài khoản**, field "Mật khẩu (đã che)", kèm email admin thực hiện.

---

## 5. Liên Kết & Tài Liệu Tham Chiếu 📌
- [[03 - Web Portal (Next.js)]] — cập nhật trang Quản Lý Nhân Sự (employees-view.tsx)
- [[02 - Backend NestJS (API)]] — bổ sung EmployeesModule: reset-password + password-policy util
- [[2026-09-23 Trang Cài Đặt Hệ Thống - 7 Mục Sidebar & Audit Log]] — nền tảng SettingsAuditService mở rộng section `account`
- [[21 - Nhật Ký Ngày 25-09-2026 (Chẩn Đoán Slack CSKH & Redesign Toolbar Bảng Lương)]] — dev log trước trong ngày
- [[09 - Task Checklist]] — theo dõi tiến độ tổng
