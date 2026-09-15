---
tags: [khoa-luan, database, prisma, postgresql, schema]
created: 2026-09-04
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

## Enums

| Enum | Values |
|------|--------|
| `UserRole` | ADMIN, HR_MANAGER, MANAGER, EMPLOYEE |
| `EmploymentStatus` | ACTIVE, ON_LEAVE, TERMINATED, PROBATION |
| `LeaveType` | ANNUAL, SICK, MATERNITY, PATERNITY, UNPAID, EMERGENCY |
| `LeaveStatus` | PENDING, APPROVED, REJECTED, CANCELLED |
| `AttendanceStatus` | PRESENT, ABSENT, LATE, HALF_DAY, REMOTE, ON_LEAVE |
| `ContractType` | FULL_TIME, PART_TIME, PROBATION, FREELANCE, INTERNSHIP |
| `PayrollStatus` | DRAFT, APPROVED, PAID, CANCELLED |
| `ChatSessionType` | **HR_QA**, **CSKH**, **TRAINING** |
| `NotificationType` | PAYROLL, LEAVE, ATTENDANCE, ONBOARDING, SYSTEM |
| `OnboardingTaskStatus` | PENDING, IN_PROGRESS, COMPLETED, SKIPPED |

## Models

### Core (Auth & Users)

```
User ──► Employee (1:1)
     └─► RefreshToken (1:N)
     └─► Notification (1:N)
```

### HR Domain

```
Department ──► Position ──► Employee
                              ├─► Attendance (1:N)
                              ├─► LeaveRequest (1:N)
                              ├─► Contract (1:N)
                              └─► Payroll (1:N)
```

| Model | Mục đích |
|-------|----------|
| `User` | Tài khoản đăng nhập (auth) |
| `Employee` | Thông tin nhân viên |
| `Department` | Phòng ban (phân cấp tự tham chiếu) |
| `Position` | Vị trí / chức danh |
| `Attendance` | Bản ghi chấm công (unique: employee + date) |
| `LeaveRequest` | Đơn xin nghỉ |
| `Contract` | Hợp đồng lao động |
| `Payroll` | Phiếu lương (unique: employee + month + year) |
| `SalaryConfig` | Cấu hình hệ số theo năm |

### AI & Training Domain

| Model | Mục đích |
|-------|----------|
| `OnboardingTask` | Danh mục task onboarding |
| `OnboardingProgress` | Tiến độ từng nhân viên |
| `AiChatSession` | Phiên chat (HR_QA / CSKH / TRAINING) |
| `AiChatMessage` | Từng tin nhắn trong phiên (role: user/assistant) |
| `Notification` | Thông báo real-time |

### Raw-SQL Tables (ngoài Prisma schema)

Tạo bằng `$executeRawUnsafe` vì sandbox chặn `prisma db push` / vì kiểu dữ liệu đặc thù:

| Bảng | Mục đích | Ghi chú |
|-------|----------|---------|
| `office_geofences` | Geofence chấm công GPS (id `default`, lat/lng/radiusM) | Model `OfficeGeofence` |
| `policy_chunks` *(14/09 — RAG)* | Kho tri thức chính sách: `doc_title`, `chunk_index`, `content`, `source`, `embedding_json` JSONB, `embedding vector(768)` (chỉ khi có pgvector) | Unique `(doc_title, chunk_index)`; index HNSW `vector_cosine_ops` khi pgvector ON. Seed: `packages/database/scripts/seed-knowledge.cjs` — 10 tài liệu chính sách, embedding Gemini `gemini-embedding-001` |

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

*Liên kết:* [[02 - Backend NestJS (API)]] | [[08 - Infrastructure & DevOps]]
