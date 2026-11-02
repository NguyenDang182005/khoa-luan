-- =====================================================================
-- Đồng bộ schema với migration history (phát hiện khi audit 30/10/2026)
--
-- Trước bản này, DB được tạo bằng `prisma db push` ở một số máy nên nhiều cột
-- có trong schema.prisma nhưng KHÔNG có trong migration. Hệ quả: dựng DB mới
-- từ migration thì API lỗi P2022 (cột không tồn tại) ở chấm công / đơn OT.
-- =====================================================================

-- 1. LeaveType thiếu 4 giá trị (OT, LATE_PERMISSION, BUSINESS_TRIP, OTHER)
ALTER TYPE "LeaveType" ADD VALUE IF NOT EXISTS 'OT';
ALTER TYPE "LeaveType" ADD VALUE IF NOT EXISTS 'LATE_PERMISSION';
ALTER TYPE "LeaveType" ADD VALUE IF NOT EXISTS 'BUSINESS_TRIP';
ALTER TYPE "LeaveType" ADD VALUE IF NOT EXISTS 'OTHER';

-- 2. Số công chấm công (Payroll và check-out đều đọc cột này)
ALTER TABLE "attendances" ADD COLUMN IF NOT EXISTS "workDays" DOUBLE PRECISION;

-- 3. Đơn tăng ca (OT) lưu số giờ + ngày làm thêm
ALTER TABLE "leave_requests" ADD COLUMN IF NOT EXISTS "overtimeDate" DATE;
ALTER TABLE "leave_requests" ADD COLUMN IF NOT EXISTS "overtimeHours" DOUBLE PRECISION;

-- 4. Default cấu hình phép (khớp schema.prisma: tắt cộng thâm niên/chuyển phép)
ALTER TABLE "leave_policies" ALTER COLUMN "seniorityBonusEveryYears" SET DEFAULT 0;
ALTER TABLE "leave_policies" ALTER COLUMN "seniorityBonusDays" SET DEFAULT 0;

-- 5. OfficeGeofence: schema yêu cầu NOT NULL + default 'default'
UPDATE "office_geofences" SET
  "name" = COALESCE("name", 'Văn phòng công ty'),
  "lat" = COALESCE("lat", 10.7951),
  "lng" = COALESCE("lng", 106.7218),
  "radiusM" = COALESCE("radiusM", 200);

ALTER TABLE "office_geofences"
  ALTER COLUMN "id" SET DEFAULT 'default',
  ALTER COLUMN "name" SET NOT NULL,
  ALTER COLUMN "lat" SET NOT NULL,
  ALTER COLUMN "lng" SET NOT NULL,
  ALTER COLUMN "radiusM" SET NOT NULL;
