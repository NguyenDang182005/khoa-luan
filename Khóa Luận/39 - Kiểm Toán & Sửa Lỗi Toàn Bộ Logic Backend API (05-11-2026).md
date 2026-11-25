---
tags: [khoa-luan, code-review, audit, nestjs, payroll, attendance, leave, ai-agents, unit-test]
created: 2026-11-05
updated: 2026-11-05
---

# 39 - Kiểm Toán & Sửa Lỗi Toàn Bộ Logic Backend API (05-11-2026)

Liên quan: [[00 - Tổng Quan Dự Án]] · [[02 - Backend NestJS (API)]] · [[30 - Business Logic & ADR Alignment (Verified 17-10-2026)]] · [[38 - Kiểm Thử Toàn Bộ Endpoint, Đối Chiếu Sơ Đồ & Leo Thang Realtime (05-11-2026)]]

---

## 1. Bối cảnh & Phạm vi Kiểm toán (`/code-review`)

Thực hiện rà soát toàn diện **85+ file mã nguồn** trong `apps/api/src` đối chiếu với `packages/database/prisma/schema.prisma`, `CONTEXT.md`, và các workflow `n8n-workflows/01..04.json` trên 3 cụm phân hệ:
1. **HR Core & Rule Engine:** `common/*`, `attendance/*`, `leave/*`, `payroll/*`, `contracts/*`, `salary-config/*`
2. **Auth, Security, RBAC & Organization:** `auth/*`, `firebase/*`, `employees/*`, `departments/*`, `onboarding/*`, `settings/*`, `dashboard/*`
3. **AI Agents, RAG, Training & Integrations:** `agents/*`, `ai-context/*`, `knowledge/*`, `training/*`, `notifications/*`, `slack/*`

---

## 2. Danh sách Lỗi đã Phát hiện & Khắc phục

### 2.1. Cụm Common, Timezone & Prisma Exception Filter
- **Cố định múi giờ `+07:00` cho các mốc giờ làm việc (`vn-date.ts`):**
  - **Vấn đề:** `AttendanceService` gọi `.setHours(8, 0, 0, 0)` và `.setHours(17, 0, 0, 0)` trực tiếp trên đối tượng `Date` `00:00 UTC` (`vnDateUtc()`). Nếu server/Docker chạy ở `TZ=UTC`, mốc 8h sáng bị đặt thành `08:00 UTC` (`15:00 chiều` giờ VN), làm sai toàn bộ giờ công và giờ OT. Ngoài ra `vnMinutesOfDay` dùng `hour12: false` có thể trả `24:xx` (`1440` phút) lúc nửa đêm.
  - **Khắc phục:** Bổ sung hàm `vnTimeOnDate(date, hour, minute)` tạo mốc thời gian chuẩn `+07:00` (`YYYY-MM-DDTHH:mm:00.000+07:00`) và dùng `hourCycle: 'h23'` trong `vnMinutesOfDay`.
- **Chuẩn hóa `workdays.ts` trên UTC midnight của `@db.Date`:**
  - **Vấn đề:** `dayKey`, `isWeekend`, `countWorkdays`, `eachDay` dùng `setHours(0,0,0,0)` / `getDate()` theo giờ local của OS khiến mốc `00:00 UTC` bị lùi về `17:00 UTC` ngày hôm trước.
  - **Khắc phục:** Chuẩn hóa qua `toUtcMidnight(d)` và các phương thức `getUTCFullYear`, `getUTCMonth`, `getUTCDate`, `getUTCDay`, đảm bảo tính nhất quán tuyệt đối với cột `@db.Date` của Prisma.
- **Mở rộng `PrismaExceptionFilter` (`prisma-exception.filter.ts`):**
  - Map thêm `P2002` → `409 Conflict` (trùng khóa duy nhất) và `P2003` → `400 Bad Request` (sai khóa ngoại) thay vì trả `500 Internal Server Error`.

### 2.2. Cụm Chấm công (`attendance/*`)
- **Sửa công thức tính OT ngày thường & cuối tuần trong `checkOutForUser`:**
  - **Vấn đề:** Khi cả `checkIn` và `checkOut` đều nằm sau 17:00 (ví dụ `18:00 → 19:00`), `afterMinutes` tính `19:00 - 17:00 = 2 giờ` thay vì `1 giờ`. Ngày cuối tuần, `spansLunch` trừ cứng 1 giờ nghỉ trưa kể cả khi chỉ làm lẹm vào khung `12:00–13:00` 15 phút (`11:30 → 12:15`).
  - **Khắc phục:** Kẹp biên `beforeEnd = min(now, startOfWork)` và `afterStart = max(checkIn, endOfWork)` khi tính OT ngày thường; tính đúng thời lượng giao nhau thực tế với khung `12:00–13:00` cho ngày cuối tuần/lễ; bổ sung fallback `OR` khi tìm đơn OT có `overtimeDate = null`.
- **Đồng bộ `getMonthlyReport` & khóa kỳ lương trong `upsertRecord`:**
  - Đồng bộ công thức cộng `totalWorkDays` trong `getMonthlyReport()` khớp với `PayrollService.calculatePayroll()`.
  - Trong `upsertRecord()`: chặn sửa chấm công nếu kỳ lương tháng đó đã `APPROVED` hoặc `PAID`, và đặt `workDays = 0` nếu ngày sửa rơi vào `WEEKEND` hoặc `HOLIDAY`.
- **Sửa ép kiểu tọa độ GPS trong `AttendanceController.checkIn`:**
  - Không ép `Number(undefined)` hoặc `Number(null)` thành `0` (tọa độ `0, 0` hợp lệ với `Number.isFinite(0)`).

### 2.3. Cụm Nghỉ phép & Tăng ca (`leave/*`)
- **Cho phép ADMIN hủy đơn nghỉ đã `APPROVED` & dọn chấm công `ON_LEAVE`:**
  - **Vấn đề:** Trước đây đơn đã `APPROVED` không ai hủy được (kể cả Admin), trong khi `approve()` đã ghi sẵn các dòng `Attendance` `ON_LEAVE` cho cả ngày tương lai, khiến nhân viên đi làm lại không thể check-in.
  - **Khắc phục:** Mở rộng `LeaveService.cancel(id, callerUserId, isAdmin)`: cho phép ADMIN hủy đơn `APPROVED` (khi kỳ lương chưa khóa) và tự động xóa các bản ghi `Attendance` `ON_LEAVE` (`checkIn: null`) do đơn đó sinh ra trong `$transaction`.
- **Kiểm tra hạn mức phép năm (`ANNUAL`) cho đơn vắt qua 2 năm dương lịch:**
  - **Vấn đề:** Đơn từ `30/12/2026` đến `04/01/2027` lấy tổng số ngày của cả 2 năm trừ vào quỹ phép của riêng năm `2026`.
  - **Khắc phục:** Tách số ngày làm việc của đơn theo từng năm dương lịch trong cả `create()` và `approve()` để kiểm tra đúng với `getBalance(employeeId, y)` của từng năm.
- **Chống duyệt trùng đơn trong `$transaction` & tách `LATE_PERMISSION`:**
  - Kiểm tra lại xem có đơn `APPROVED` nào trùng khoảng ngày ngay bên trong `$transaction` (sau `SELECT ... FOR UPDATE`) của `approve()`.
  - Không để đơn xin đi muộn `LATE_PERMISSION` chặn việc nộp đơn nghỉ phép/nghỉ ốm cùng ngày.
  - Trong `computeBaseQuota` (`leave-entitlement.ts`): trả `quota = 0` nếu truy vấn năm nhỏ hơn năm vào làm (`year < joinYear`).

### 2.4. Cụm Bảng lương, Hợp đồng & Cấu hình lương (`payroll/*`, `contracts/*`, `salary-config/*`)
- **Tính lại thuế TNCN (`tax`) khi điều chỉnh thưởng (`PayrollService.adjust`):**
  - **Vấn đề:** `adjust()` cộng thẳng `bonus` vào `netSalary` mà giữ nguyên `payroll.tax` cũ, làm tiền thưởng khi sửa tay trở thành miễn thuế 100% và lệch với `generate()`.
  - **Khắc phục:** Tính lại `grossIncome`, `taxableIncome`, `tax = calculatePit(taxableIncome, rule)` và `netSalary` ngay trong `adjust()`.
- **Chống cộng trùng 2 lần ngày công (200% lương) giữa `Attendance` và `LeaveRequest`:**
  - Lưu tập `workedDayKeys` của các ngày đã tính công trực tiếp từ bảng `attendances` và loại trừ các ngày này trong `countLeaveDays(['ANNUAL', 'BUSINESS_TRIP'])`, đồng thời kẹp trần `Math.min(workingDays, actualWorkingDays)`.
- **Ưu tiên hợp đồng `isActive: true` và đồng bộ `SalaryConfig`:**
  - Sắp xếp `orderBy: [{ isActive: 'desc' }, { startDate: 'desc' }]` khi chọn hợp đồng tính lương để không bốc nhầm hợp đồng tạo nhầm đã bị deactivate.
  - Đồng bộ truy vấn `SalaryConfig` (`where: { year: { lte: year } }`) giữa `PayrollService` và `SalaryConfigService.getCurrent()`, bảo vệ `standardWorkHours > 0` để tránh chia cho `0` (`NaN`).
- **Chuẩn hóa ngày hợp đồng (`ContractsController` & `ContractsService`):**
  - Dùng `vnDateUtc()` cho `startDate`, `endDate`, `signedDate`; hỗ trợ xóa `endDate = null`; kiểm tra `endDate >= startDate` và `baseSalary > 0`.

### 2.5. Cụm Nhân sự, Xác thực, Phòng ban & Dashboard (`employees/*`, `auth/*`, `departments/*`, `dashboard/*`)
- **Chặn Mass-Assignment & bảo vệ tài khoản `.placeholder.` / `TERMINATED` (`EmployeesService`):**
  - Lọc danh sách khóa trắng `ALLOWED_UPDATE_KEYS` trong `EmployeesService.update()`; chặn tự gán `managerId === id`.
  - Đưa bước tạo `User` vào bên trong `$transaction` của `EmployeesService.create()` để không sinh `User` mồ côi khi tạo `Employee` thất bại.
  - Trong `EmployeesService.updateAccount()`: đồng bộ `email` trên cả 2 bảng `users` và `employees` trong `$transaction`, xóa `firebaseUid`/`googleId`/`facebookId` cũ khi đổi sang email mới, và không tự bật `isActive = true` nếu nhân viên đang `TERMINATED`.
  - Trong `EmployeesService.update()`: khi chuyển trạng thái sang `ACTIVE`/`PROBATION`/`ON_LEAVE`, chỉ mở lại tài khoản nếu email user không phải là `.placeholder.`.
- **Tăng cường bảo mật `AuthService` & `JwtStrategy`:**
  - Kiểm tra `employee.status !== 'TERMINATED'` ở cả `login()`, `loginWithFirebase()`, và `JwtStrategy.validate()`.
  - Kiểm tra `user.lockedUntil` ngay trong `JwtStrategy.validate()`.
  - Gắn `jti: randomUUID()` vào `refreshToken` (tránh lỗi trùng token `P2002` khi đăng nhập 2 lần trong cùng 1 giây) và đồng bộ `expiresAt` với `SecurityPolicy.accessTokenTtlHours`.
  - Kiểm tra xung đột `firebaseUid`/`googleId`/`facebookId` trước khi liên kết trong `loginWithFirebase()`.
- **Ẩn khung lương trong `DepartmentsService.findOne` & sửa `DashboardService`:**
  - Không trả `minSalary`/`maxSalary` của `Position` trong `GET /departments/:id` (endpoint mở cho mọi nhân viên).
  - Trong `DashboardService`: dùng `a.date.getUTCDate()` thay vì `getDate()`, tính cả `REMOTE` và `HALF_DAY` vào tỷ lệ đi làm, giới hạn `take: 1000` cho `recentAiMessages` và nhận diện workflow hoạt động qua cả `session.type` lẫn `metadata`.

### 2.6. Cụm AI Agents, AI Context, Training, RAG, Notifications & Slack
- **Sửa lỗi bắn trùng $N$ thông báo Escalation (`AiContextService.escalateToHuman`):**
  - Bỏ `.to('admin')` khi emit `notification:new` bên trong vòng lặp từng Admin (chỉ emit tới `user:${admin.id}`), giúp mỗi Admin chỉ nhận đúng 1 thông báo của chính mình và đánh dấu đã đọc không bị lỗi `404`.
  - Tự động join room `'admin'` ngay trong `NotificationsGateway.handleConnection()` khi `payload.role === 'ADMIN'` để tránh race condition với sự kiện `join-admin`.
- **Đồng bộ `session.type` và chống giả mạo đáp án Quiz (`AiContextService` & `TrainingService`):**
  - Khi WF03 gọi `createOrGetSession` với `sessionId` đã tạo sẵn từ `portalChat` (vốn mặc định `HR_QA` khi `sessionType = 'OTHER'`), tự động cập nhật `session.type` sang `TRAINING` để `loadServerQuizAnswers` tìm thấy đề quiz đã stash.
  - Trong `TrainingService.submitQuiz()`: luôn ưu tiên ghi đè `correctAnswer` từ `correctById` của server (chống client tự gửi `correctAnswer` giả mạo); đọc cả `q.correct ?? q.correctAnswer`; hỗ trợ cả `problemSolving` lẫn `problem_solving` trong `getAnalytics()`; sửa `fallbackGrade` dùng `a.questionId ?? i + 1`.
- **Thống kê Router & CSKH Takeover (`AgentsService` & `AiContextService`):**
  - Trong `AgentsService.getIntentStats()`: dùng `COALESCE(m.metadata->>'intent', s.type::text)` và `JOIN ai_chat_sessions` để đếm đầy đủ cả tin nhắn CSKH (WF04) và Roleplay (WF03), trả đúng số lượng `escalations`.
  - Ghi nhận `latency_ms` vào `metadata` của message assistant sau mỗi lượt `portalChat`.
  - Khi gọi `deactivateSession()` hoặc `replyToSession()`, đảm bảo gán `isActive: false` và `escalatedAt`; lấy `threadTs` từ tin nhắn user mới nhất (`orderBy: { createdAt: 'desc' }`).
  - Hỗ trợ đọc `AiAgentConfig.apiKey` trong `ApiKeyGuard`; bọc `try/catch` an toàn cho `KnowledgeService.search()` và `SlackService.onApplicationBootstrap()`.

---

## 3. Kết Quả Kiểm Thử (Jest Unit & Regression Tests + Build)

Đã cập nhật và viết mới các bộ unit test, nâng tổng số lên **9 test suites / 66 unit tests** — tất cả đều **PASS 100%**:

```text
PASS src/leave/leave-entitlement.spec.ts
PASS src/payroll/payroll-pit.spec.ts
PASS src/common/vn-date.spec.ts
PASS src/attendance/attendance.service.spec.ts
PASS src/training/training.service.spec.ts
PASS src/leave/leave.service.spec.ts
PASS src/payroll/payroll.service.spec.ts
PASS src/employees/employees.service.spec.ts
PASS src/ai-context/ai-context.service.spec.ts

Test Suites: 9 passed, 9 total
Tests:       66 passed, 66 total
```

Kiểm tra biên dịch TypeScript (`pnpm --filter api exec tsc --noEmit`) và `pnpm --filter api build` (`nest build`) đều thành công (`exit code 0`).


---

## 4. Đồng bộ Sơ đồ UML (`.puml` / `.png` / `.svg`) & Báo cáo Google Docs (`gdocs` CLI)

Liên kết báo cáo: [Báo cáo Khóa luận Google Docs](https://docs.google.com/document/d/1maZALMYXxLZdKnyXzSNHpuGgvo5mAkLw315eNCBDge8/edit?tab=t.0) (`1maZALMYXxLZdKnyXzSNHpuGgvo5mAkLw315eNCBDge8`)

### 4.1. Vẽ lại & Thay thế 8 Sơ đồ UML trong Báo cáo
Đã cập nhật mã PlantUML trong `docs/diagrams/uml/`, render lại `.png` (DPI 180) + `.svg` vào `docs/diagrams/`, tối ưu tỷ lệ khung hình để chiều cao khi hiển thị ở khổ chữ `425 pt` luôn $\le 552\text{ pt}$ (không tràn trang), và thay thế trực tiếp bằng `gdocs mutate replace-image-safe`:

| Hình trong báo cáo | File sơ đồ | Nội dung cập nhật | Kích thước trên Docs (`pt`) |
|---|---|---|---|
| **Hình 3.9** | `H3-09-auth.puml` | Kiểm tra thêm `Employee.status !== TERMINATED` và `lockedUntil` khi đăng nhập / xác thực JWT | `425.2 × 404.0` |
| **Hình 4.2** | `H4-11-employee-create.puml` | Đưa toàn bộ bước tạo `User`, `Employee`, `Contract` thử việc và gán `OnboardingTask` vào khối `Transaction ($transaction)` | `425.2 × 411.0` |
| **Hình 4.3** | `H4-02-attendance.puml` | Nhánh làm việc cuối tuần/ngày lễ trừ phần thời gian giao thực tế với khung nghỉ trưa `12:00–13:00` | `425.2 × 513.0` |
| **Hình 4.4** | `H4-03-leave-state.puml` | Bổ sung chuyển trạng thái `APPROVED -> CANCELLED` cho `ADMIN` (khi kỳ lương mở, xóa chấm công `ON_LEAVE`); ghi chú kiểm tra trùng đơn đã duyệt và tách số dư phép theo từng năm | `425.2 × 260.0` |
| **Hình 4.5** | `H4-04-leave-approve.puml` | Bỏ qua đơn đi muộn (`LATE_PERMISSION`) khi kiểm tra trùng ngày nghỉ; tách số dư phép năm theo từng năm; kiểm tra trùng đơn `APPROVED` ngay trong transaction `FOR UPDATE` | `425.2 × 528.0` |
| **Hình 4.6** | `H4-05-payroll-engine.puml` | Cập nhật công thức `Ngày công thực tế = min(ngày công chuẩn, workDays ngày thường + ngày phép năm/công tác đã duyệt chưa có chấm công)` | `425.2 × 552.0` |
| **Hình 4.7** | `H4-06-payroll-state.puml` | Cập nhật thao tác `adjust` thưởng/tạm ứng trên phiếu `DRAFT` tự động tính lại thuế TNCN (`tax`) | `425.2 × 120.0` |
| **Hình 4.12** | `H4-10-cskh-escalation.puml` | Phát sự kiện `notification:new` tới `room user:<adminId>` cho từng ADMIN (bỏ phát lặp vào room `admin`) | `425.2 × 241.0` |

### 4.2. Cập nhật Thuyết minh & Bảng biểu trên Google Docs
- **Mục 3.4.4:** Sửa endpoint `POST /ai-context/outbound-reply` → `POST /n8n/outbound-reply`.
- **Mục 4.2.1, 4.2.2, 4.2.4, 4.2.5:** Đồng bộ mô tả kiểm tra trạng thái `TERMINATED`, tạo `User` trong cùng transaction, `ADMIN` hủy đơn `APPROVED` và xóa bản ghi `ON_LEAVE`, kiểm tra phép năm vắt qua 2 năm, chống tính trùng ngày phép đã đi làm và tính lại thuế TNCN khi điều chỉnh thưởng.
- **Mục 4.3.2:** Sửa điểm chấm dự phòng tự luận từ `6/10` → `5/10` khớp với `TrainingService.fallbackGrade`.
- **Mục 4.4.1, Tiểu kết Chương 4, Mục 5.3 & Bảng 4.3:** Cập nhật số lượng bộ kiểm thử đơn vị từ `6/6 bộ (49/49 test case)` lên **`9/9 bộ (69/69 test case)`** kèm chi tiết 9 tệp `.spec.ts` trong Bảng 4.3.

---

## 5. Xác nhận 6 Kịch bản Nghiệp vụ Nghỉ phép / Chấm công / Lương (Đạt 100%)

| # | Kịch bản / Lỗi trước đây | Cơ chế bảo vệ hiện tại trong Code |
|---|---|---|
| **1** | Duyệt hàng loạt vượt số dư phép | Khóa `SELECT id FROM employees WHERE id = ... FOR UPDATE` trong `$transaction`, kiểm tra lại `fresh.status === 'PENDING'`, không trùng đơn `APPROVED` khác và kiểm tra số dư phép năm tách theo từng năm (`LeaveService.approve`). |
| **2** | Đến muộn mất trọn công | Duyệt `LATE_PERMISSION` chỉ đổi `status: 'LATE' -> 'PRESENT'`, giữ nguyên `workHours`/`workDays`. Nếu duyệt trước khi check-in thì lúc check-in muộn ghi luôn `PRESENT` (`AttendanceService.checkInForUser`). Đơn `LATE_PERMISSION` không chặn tạo đơn nghỉ cả ngày. |
| **3** | Công tác 0 công, chồng sinh không có trợ cấp | `BUSINESS_TRIP` cộng vào `paidLeaveDays` hưởng nguyên lương; `PATERNITY` gộp cùng `MATERNITY` tính trợ cấp BHXH 100% (`PayrollService.calculatePayroll`). |
| **4** | Duyệt nghỉ đè lên ngày đã đi làm | Chặn 3 lớp: (1) Duyệt đơn nghỉ vào ngày đã có `checkIn !== null` → `400 Bad Request`; (2) Check-in vào ngày đã có `status === 'ON_LEAVE'` → `409 Conflict`; (3) Tính lương loại trừ `workedDayKeys` và kẹp `actualWorkingDays <= workingDays`. |
| **5** | Duyệt đơn vào tháng đã chốt lương | `assertPayrollOpen()` chặn `400 Bad Request` khi kỳ lương liên quan ở trạng thái `APPROVED` hoặc `PAID` (áp dụng cho cả duyệt đơn, hủy đơn đã duyệt và sửa chấm công thủ công `upsertRecord`). |
| **6** | Đơn OT thiếu ngày làm thêm không được trả | Khi tạo đơn `OT`, `overtimeDate` mặc định bằng `startDate`; khi check-out và tính lương đều truy vấn `OR: [{ overtimeDate: ... }, { overtimeDate: null, startDate: ... }]` và lấy `req.overtimeDate ?? req.startDate`. |

---

## 6. Bổ sung Quản lý Hợp đồng (Active Contract) & Tính Công lẻ theo 2 Ca (Chiều 05/11/2026)

### 6.1. Sửa lỗi Quản lý & Kích hoạt Hợp đồng (`ContractsService`, `EmployeesService`, `employees-view.tsx`)
1. **Backend (`apps/api`):**
   - Bổ sung `PATCH /contracts/:id/activate` để kích hoạt hợp đồng và tự động tắt các hợp đồng khác của cùng nhân viên trong `$transaction`.
   - Mở rộng `PATCH /contracts/:id` cho phép sửa `type`, `startDate`, `endDate`, `baseSalary`, `allowances`, `isActive`.
   - Khi chuyển trạng thái nhân viên sang `ACTIVE` (`EmployeesService.update`), tự động kích hoạt lại hợp đồng gần nhất (nếu chưa có HĐ active) và nâng loại hợp đồng từ `PROBATION` lên `FULL_TIME`.
2. **Frontend (`apps/web`):**
   - Thêm trường nhập **Lương cơ bản** và **Phụ cấp** ngay trong Dialog *"Thêm nhân viên mới"* để nhân viên mới tạo luôn có hợp đồng active.
   - Bổ sung nút **`Sửa / Đổi trạng thái HĐ`**, **`+ Hợp đồng mới`** và nút bật/tắt nhanh **`Kích hoạt lại (Active)` / `Hủy hiệu lực`** ngay trong Drawer hồ sơ nhân sự.

### 6.2. Cơ chế Tính công lẻ chính xác theo 2 Ca làm việc (`08:00–12:00` & `13:30–17:30`)
- **Khi mới Check-in (chưa Check-out):** Khởi tạo `workDays = 0` (trên lịch hiển thị rõ trạng thái `chưa check-out`, `0,0` công thay vì cộng cứng `1,0` công).
- **Khi Check-out:** Tự động kẹp thời gian `[checkIn, checkOut]` vào đúng 2 khung ca làm việc hành chính:
  - **Ca sáng:** `08:00 – 12:00` (`240 phút`)
  - **Ca chiều:** `13:30 – 17:30` (`240 phút`)
  - **Công thức:** $\text{workDays} = \text{round}_4\left(\min\left(\frac{\text{workMinutes}}{480},\; 1\right)\right)$ (giữ tối đa 4 chữ số thập phân).
  - Ví dụ:
    - Check-in `07:55` $\rightarrow$ Check-out `12:09`: kẹp đúng `[08:00, 12:00]` = `240/480` = **`0,5` công** (`0` giờ OT).
    - Check-in `07:50` $\rightarrow$ Check-out `10:00`: kẹp đúng `[08:00, 10:00]` = `120/480` = **`0,25` công**.
    - Làm 3 tiếng buổi chiều (`14:30 -> 17:30`): `180/480` = **`0,375` công**.
    - Làm 1,5 tiếng (`14:00 -> 15:30`): `90/480` = **`0,1875` công**.
    - Check-in xong Check-out ngay (`< 1 phút`): **`0` công**.
- **Đồng bộ tính công trực tiếp từ mốc giờ `[checkIn, checkOut]` trong `PayrollService` & `AttendanceService.getMonthlyReport`:**
  - Khi tính lương (`calculatePayroll`) và tổng hợp bảng công tháng (`getMonthlyReport`), nếu bản ghi chấm công có đầy đủ `checkIn` và `checkOut` thật (`status !== 'HALF_DAY'`), hệ thống gọi trực tiếp `workDaysFromTimestamps(a.date, a.checkIn, a.checkOut)` để tính lại số công từ mốc giờ `[checkIn, checkOut]` theo 2 ca chia cho `480 phút`.
  - Nhờ đó các bản ghi cũ trước đây từng bị lưu cứng `workDays = 0.25` khi check-in/check-out tức thì (như `EMP005` và `EMP006` ngày `05/11/2026`) được tính chuẩn về `0` công và tái tạo lại bảng lương nháp tháng `11/2026` (`30/30` nhân sự đang làm việc).
- **Tổng số Unit Test Backend (`apps/api`):** Đạt **`9/9` bộ kiểm thử, `69/69` unit tests PASS** (đã đồng bộ lên cả sơ đồ `H4-02-attendance.png`, thuyết minh Mục 4.2.3, Mục 4.2.5 và Bảng 4.3 trên Google Docs).

### 6.3. Nâng cấp UI/UX Bảng xếp hạng Đào tạo & Hộp thoại Chi tiết Bài thi AI (`TrainingService.getAnalytics`, `training-analytics-view.tsx`)
1. **Backend (`apps/api/src/training/training.service.ts`) & Schema (`apps/web/lib/schemas/training.schema.ts`):**
   - Cập nhật `TrainingService.getAnalytics()` trả kèm danh sách `attempts` (`id`, `answer`, `isCorrect`, `aiEvaluation`, sắp xếp theo `createdAt: 'asc'`) trong từng phiên đào tạo đã chấm (`GRADED`).
2. **Frontend (`apps/web/components/views/training-analytics-view.tsx`):**
   - **Thay thanh điểm mini bằng thẻ điểm số rõ ràng:** Cột *"Tiêu chí AI (thang 10)"* hiển thị lưới `2x2` thẻ điểm số có nhãn và chấm màu rõ ràng: **CN** (Chuyên nghiệp), **TC** (Thấu cảm), **GP** (Giải pháp), **RR** (Rõ ràng) kèm điểm `X/10`.
   - **Hộp thoại Chi tiết Bài thi & Nhận xét AI (`Dialog`):** Cho phép nhấn vào bất kỳ dòng học viên nào trên bảng xếp hạng để mở modal xem trọn vẹn:
     - Thông tin học viên, mã nhân viên, phòng ban, kịch bản tập huấn và thời điểm nộp bài.
     - 3 thẻ tóm tắt điểm số: `Trắc nghiệm (/50)`, `Tự luận AI (/50)`, `Tổng điểm toàn bài (/100)`.
     - Đánh giá chi tiết 4 tiêu chí AI (thang điểm 10) với tên đầy đủ, điểm số `X / 10` và thanh tiến trình độ tương phản cao.
     - Toàn bộ **Nhận xét tổng hợp từ AI (`aiFeedback`)** không bị cắt dòng.
     - **Danh sách từng câu trả lời (`attempts`):** Hiển thị từng câu hỏi trắc nghiệm/tự luận, câu trả lời của học viên, đáp án đúng (nếu làm sai), điểm AI `/10` và nhận xét riêng của AI cho từng câu.
   - Đã cập nhật thuyết minh Mục `4.3.2` và Bảng `5.1` trên Báo cáo Google Docs.

### 6.4. Chuẩn hóa Nhật ký PII Masking (`AiContextService.saveMessage`, `AgentsService.getPiiAudit`, `cskh-escalation-view.tsx`, `ai-agents-view.tsx`)
1. **Backend & Workflow (`apps/api` & `n8n-workflows`):**
   - Trong `AgentsService.getPiiAudit()`: Bổ sung điều kiện lọc `where: { role: 'user' }` để bảng Nhật ký PII Masking chỉ truy vấn tin nhắn đầu vào của người dùng (loại bỏ các dòng phản hồi `role: 'assistant'` của AI vốn không thuộc đối tượng lọc PII đầu vào).
   - Trong `AiContextService.saveMessage()` và `02-hr-qa-agent.json`: Tự động tính và đính kèm `metadata.maskedMessage` (theo đúng 3 quy tắc Regex của WF01: `\b(\d{9}|\d{12})\b` $\rightarrow$ `[MASKED_ID]`, `\b(0[35789]\d{8})\b` $\rightarrow$ `[MASKED_PHONE]`, `[\w.-]+@[\w.-]+\.\w+` $\rightarrow$ `[MASKED_EMAIL]`) cho mọi tin nhắn `role === 'user'` trên tất cả các kênh (`HR_QA`, `TRAINING`, `CSKH`), đồng thời backfill cho toàn bộ 174 tin nhắn `user` hiện có trong Database.
2. **Frontend (`cskh-escalation-view.tsx` & `ai-agents-view.tsx`):**
   - Phân biệt rõ 3 trạng thái kiểm duyệt trên bảng đối chiếu PII:
     - **`Đã che PII`** (`success`): Tin nhắn có chứa thông tin nhạy cảm và đã được thay bằng token `[MASKED_*]` trước khi gửi tới LLM.
     - **`An toàn (Không PII)`** (`info`): Tin nhắn đã đi qua bộ lọc PII Masking và không chứa dữ liệu nhạy cảm.
     - **`Chưa qua bộ lọc`** (`warning`): Chỉ hiển thị nếu bản ghi cũ thiếu `metadata.maskedMessage`.
   - Đã đồng bộ thuyết minh vào **Mục 2.4.2** và **Mục 4.5.3** trên Báo cáo Google Docs (`1maZALMYXxLZdKnyXzSNHpuGgvo5mAkLw315eNCBDge8`).
