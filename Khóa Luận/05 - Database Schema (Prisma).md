---
tags: [khoa-luan, database, prisma, postgresql, schema]
created: 2026-09-04
updated: 2026-10-16
---

# 🗄️ Database Schema (Prisma + PostgreSQL)

## Thông Tin

| Mục | Giá trị |
|-----|----------|
| **ORM** | Prisma |
| **Database** | PostgreSQL 16 |
| **Path** | `packages/database/prisma/schema.prisma` |
| **Port DB** | 5432 |
| **pgAdmin** | http://localhost:5050 |

## Enums (14 enums)

| Enum | Values |
|------|--------|
| `UserRole` | **ADMIN**, **EMPLOYEE** |
| `Gender` | MALE, FEMALE, OTHER |
| `EmploymentStatus` | ACTIVE, ON_LEAVE, TERMINATED, PROBATION |
| `LeaveType` | ANNUAL, SICK, MATERNITY, PATERNITY, UNPAID, EMERGENCY |
| `LeaveStatus` | PENDING, APPROVED, REJECTED, CANCELLED |
| `AttendanceStatus` | PRESENT, ABSENT, LATE, HALF_DAY, REMOTE, ON_LEAVE |
| `ContractType` | FULL_TIME, PART_TIME, PROBATION, FREELANCE, INTERNSHIP |
| `PayrollStatus` | DRAFT, APPROVED, PAID, CANCELLED |
| `ChatSessionType` | **HR_QA**, **CSKH**, **TRAINING** |
| `NotificationType` | PAYROLL, LEAVE, ATTENDANCE, ONBOARDING, SYSTEM |
| `OnboardingTaskStatus` | PENDING, IN_PROGRESS, COMPLETED, SKIPPED |
| `AttendanceDayType` | NORMAL, WEEKEND, HOLIDAY |
| `TrainingScenario` | CUSTOMER_COMPLAINT, COLLEAGUE_CONFLICT, MANAGER_FEEDBACK, NEW_EMPLOYEE_ONBOARDING, PERFORMANCE_REVIEW, GENERAL_COMMUNICATION |
| `TrainingAttemptStatus` | IN_PROGRESS, COMPLETED, GRADED |

## Models (22 models)

### Core (Auth & Users)

```
User ──► Employee (1:1)
     └─► RefreshToken (1:N) — kèm IP/UserAgent
     └─► Notification (1:N)
     └─► LoginHistory (1:N)
     └─► SettingsAuditLog (1:N)
```

| Model | Mục đích | Trường đáng chú ý |
|-------|----------|---------|
| `User` | Tài khoản đăng nhập | firebaseUid, googleId, facebookId, avatarUrl, displayName, failedLoginAttempts, lockedUntil, passwordChangedAt |
| `RefreshToken` | Phiên đăng nhập | ip, userAgent |
| `LoginHistory` | Lịch sử đăng nhập | email, success, reason, ip, userAgent |

### HR Domain

```
Department ──► Position ──► Employee
                              ├─► Attendance (1:N)
                              ├─► LeaveRequest (1:N)
                              ├─► Contract (1:N)
                              ├─► Payroll (1:N)
                              ├─► OnboardingProgress (1:N)
                              ├─► AiChatSession (1:N)
                              └─► TrainingSession (1:N)
```

| Model | Mục đích | Unique constraint |
|-------|----------|---------|
| `Employee` | Thông tin nhân viên | employeeCode, userId, email |
| `Department` | Phòng ban (phân cấp tự tham chiếu) | code |
| `Position` | Vị trí/chức danh | code |
| `Attendance` | Bản ghi chấm công | `@@unique([employeeId, date])` |
| `LeaveRequest` | Đơn xin nghỉ | — |
| `Contract` | Hợp đồng lao động | contractNumber |
| `Payroll` | Phiếu lương | `@@unique([employeeId, month, year])` |
| `SalaryConfig` | Cấu hình hệ số theo năm | year |

### AI & Training Domain

| Model | Mục đích |
|-------|----------|
| `AiChatSession` | Phiên chat AI (HR_QA/CSKH/TRAINING, channel web/zalo) |
| `AiChatMessage` | Từng tin nhắn (role: user/assistant, metadata JSON) |
| `OnboardingTask` | Danh mục task onboarding |
| `OnboardingProgress` | Tiến độ từng nhân viên — `@@unique([employeeId, taskId])` |
| `TrainingQuestion` | Câu hỏi đào tạo (quiz/scenario, 6 scenarios) |
| `TrainingSession` | Phiên đào tạo (kèm quizScore, aiScore JSON 4 tiêu chí, totalScore) |
| `TrainingAttempt` | Bài làm từng câu (isCorrect, aiEvaluation JSON) |
| `Notification` | Thông báo real-time |

### Settings Domain (bản ghi đơn, id = `"default"`)

| Model | Mục đích | Trường chính |
|-------|----------|--------|
| `OfficeGeofence` | Vùng địa lý chấm công GPS | lat, lng, radiusM |
| `LeavePolicy` | Chính sách phép năm | annualQuotaDays (12), prorateByJoinMonth, seniorityBonusEveryYears (0=tắt), maxCarryOverDays |
| `SecurityPolicy` | Chính sách bảo mật | passwordMinLength (8), maxFailedAttempts (5), lockoutMinutes (15), accessTokenTtlHours (720) |
| `AiAgentConfig` | Cấu hình AI Agent | enabled, webhookUrl, apiKey (write-only), timeoutMs (90000) |
| `SettingsAuditLog` | Nhật ký thay đổi cài đặt | section, field, oldValue, newValue |

### Raw-SQL Tables (ngoài Prisma schema)

| Bảng | Mục đích | Ghi chú |
|-------|----------|---------|
| `policy_chunks` *(RAG)* | Kho tri thức chính sách | `doc_title`, `chunk_index`, `content`, `embedding vector(768)`, `embedding_json JSONB`. Unique `(doc_title, chunk_index)`. Seed: `packages/database/scripts/seed-knowledge.cjs` — 10 tài liệu, Gemini `gemini-embedding-001` |

## SalaryConfig Mặc Định

| Trường | Giá trị | Mô tả |
|---------|---------|-------|
| `bhxhRate` | 8% | BHXH nhân viên |
| `bhytRate` | 1.5% | BHYT nhân viên |
| `bhtnRate` | 1% | BHTN nhân viên |
| `pitFreeAmount` | 11.000.000 VNĐ | Giảm trừ gia cảnh |
| `overtimeRate` | 1.5x | OT ngày thường |
| `otWeekendRate` | 2.0x | OT cuối tuần |
| `otHolidayRate` | 3.0x | OT ngày lễ |
| `standardWorkHours` | 8h | Giờ tiêu chuẩn/ngày |

---

*Liên kết:* [[02 - Backend NestJS (API)]] | [[08 - Infrastructure & DevOps]] | [[09 - Task Checklist]]