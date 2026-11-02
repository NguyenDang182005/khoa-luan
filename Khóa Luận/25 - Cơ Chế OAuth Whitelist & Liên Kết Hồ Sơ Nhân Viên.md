---
tags: [khoa-luan, oauth, whitelist, auth, rbac, firebase]
created: 2026-09-25
---

# 🔐 Cơ Chế OAuth Whitelist & Liên Kết Hồ Sơ Nhân Viên

> **Tài liệu biện luận 25/09/2026** — xác minh bằng code + dữ liệu thật, sau khi audit tài khoản đăng nhập cá nhân. Kết quả kiểm thử: 28/28 unit tests pass.

## 1. Nguyên tắc lõi: Whitelist = bảng `User`

Hệ thống **không có tự đăng ký**. Cổng xác thực duy nhất cho **mọi vai trò** (kể cả ADMIN) là truy vấn bảng `User` theo email lấy từ token Firebase:

```ts
// auth.service.ts:203 (loginWithFirebase) — login email/password (:87) tương tự
const user = await this.prisma.user.findUnique({ where: { email } });
if (!user || !user.isActive) → 403 "Tài khoản chưa được cấp quyền truy cập"
```

**Authentication và Authorization tách bạch hoàn toàn:**

| Khái niệm | Nơi quyết định | Admin vs Employee |
|---|---|---|
| Được đăng nhập? | Tồn tại `User` + `isActive = true` | **Giống hệt nhau** — không có nhánh riêng |
| Được làm gì? | `role` trên User → ký vào JWT lúc login → `RolesGuard` đọc JWT mỗi request | Khác nhau (ADMIN mở 7 phân hệ) |

Hệ quả thiết kế:
- **Không có backdoor admin** — không auto-provision, không bootstrap runtime. User admin đầu tiên chỉ đến từ seed (`admin@hr-system.com`) hoặc thao tác DB có chủ đích.
- **`isActive` chặn được cả admin** — khóa tài khoản = 1 bit trong DB.
- **Role không tự khai báo được** — client chỉ gửi idToken (chứa email); role đọc từ DB *tại thời điểm login* rồi ký vào JWT có `sid` + TTL theo `SecurityPolicy`.
- **Mọi phiên đều thu hồi được server-side** — `refreshToken` lưu DB; reset-password xóa sạch phiên (`employees.service.ts:271`), đổi mật khẩu thu hồi phiên khác (`auth.service.ts:290-292`).

## 2. Ba cửa đưa email vào whitelist

| Cửa | Cơ chế | Code |
|---|---|---|
| **Tạo nhân viên có role** | `POST /employees` với `role` → `createActiveUser(email, role)` — User active, email thật | `employees.service.ts:134-135` |
| **"Sửa Email & Role"** | `PATCH /employees/:id/account` (ADMIN) → `prisma.user.update({ where: { id: employee.userId } })` — đổi email User liên kết + `isActive = true` | `:184-196` |
| **Seed / thao tác DB** | User đứng riêng (admin thuần hoặc placeholder) | `seed.ts` |

> **Điểm mấu chốt dễ nhầm:** "gắn email vào employee" thực chất là **đổi email của User liên kết** — Employee chỉ là cửa UI để chạm vào User. Whitelist tra cứu `User.email`, còn `Employee.email` chỉ là trường hồ sơ.

### Placeholder — "có trong bảng nhưng chưa vào whitelist"

Tạo nhân viên **không** role → `createPlaceholderUser` sinh User email giả `${email}.placeholder.x` và **`isActive = false`** (`employees.service.ts:439-446`) → vẫn bị chặn ở dòng `!user.isActive`. Nút "Sửa Email & Role" chính là thao tác **kích hoạt** placeholder thành whitelist thật. → *"Vào whitelist" ≡ `User.isActive = true`.*

## 3. Quan hệ User ↔ Employee

```
User  (email, isActive, role) = WHITELIST — thứ auth tra cứu
Employee (userId NOT NULL)    = hồ sơ HR, LUÔN gắn vào đúng 1 User
User không có Employee        = tài khoản admin thuần (đăng nhập được, không có ESS)
```

Web sau login gọi `GET /auth/profile` → trả kèm `employee` qua quan hệ 1-1 `Employee.userId → User.id` (`auth.service.ts:323-332`). User mồ côi (không Employee) → view ESS hiển thị "Tài khoản chưa liên kết hồ sơ nhân viên" — **đúng thiết kế, không phải lỗi đăng nhập**.

### Case study 25/09 — tài khoản cá nhân

- `dangnguyen182005@gmail.com`: ADMIN, đã OAuth Google, **không có Employee** (tạo ngoài luồng nhân viên) → login OK nhưng không có hồ sơ ESS. Chứng minh thực nghiệm: *đăng nhập không bắt buộc Employee; bắt buộc User active.*
- **Fix qua đúng API**: `POST /employees` với `userId` của user có sẵn (`create-employee.dto.ts:47` → `employees.service.ts:132-133`) → **EMP0031 — Nguyễn Văn Dang** (phòng IT) gắn vào user. Lưu ý: UI không thể tự làm được — thêm nhân viên trùng email qua UI sẽ dính 409 conflict; `userId` là cửa chính thức để liên kết user có sẵn.

## 4. RBAC gap đã vá (25/09)

`POST /employees` trước đây chỉ có `JwtAuthGuard` — **mọi user đăng nhập đều tạo được nhân viên = tự whitelist email tùy ý**. Đã vá theo pattern sẵn có:

```ts
@Post()
@UseGuards(RolesGuard)
@Roles('ADMIN')   // tạo Employee = tạo User whitelist → phải là ADMIN
```

Đồng bộ với các endpoint nhạy cảm khác (`:id/account`, `:id/reset-password` đều `ADMIN_GROUP`). Regression: **28/28 tests pass** sau vá.

## 5. Dọn dữ liệu mồ côi (25/09)

- ✅ Xóa `employee@hr-system.com` (active, 0 refresh token / login history / notification — an toàn FK)
- Giữ nguyên `nguyenvana@` / `phamvanc@` (inactive **theo thiết kế seed** — minh họa trạng thái placeholder)

## 6. Câu biện vệ gọn

> *"Hệ thống có đúng một cổng xác thực cho mọi vai trò — bảng User; vai trò chỉ là thuộc tính trên bản ghi đó, không bao giờ là con đường riêng để vào hệ thống. Không có tự đăng ký: mọi định danh đăng nhập đều bắt nguồn từ quyết định nhân sự, và nhân viên IT cũng không thể cấp quyền ngoài luồng sau khi RBAC được siết."*

---

*Liên kết: [[00 - Tổng Quan Dự Án]] | [[09 - Task Checklist]] | [[23 - Quyết Định Web-Only Phase 1 (Cắt Mobile App)]] | [[24 - Audit Cơ Chế Chấm Điểm AI]]*
