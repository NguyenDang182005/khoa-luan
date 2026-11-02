-- Áp dụng diff schema của tính năng đơn nghỉ phép / OT / số công
-- Idempotent: có thể chạy nhiều lần không lỗi.

-- Thêm giá trị mới vào enum LeaveType (nếu chưa có)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'LeaveType' AND e.enumlabel = 'OT'
  ) THEN
    ALTER TYPE "LeaveType" ADD VALUE 'OT';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'LeaveType' AND e.enumlabel = 'LATE_PERMISSION'
  ) THEN
    ALTER TYPE "LeaveType" ADD VALUE 'LATE_PERMISSION';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'LeaveType' AND e.enumlabel = 'BUSINESS_TRIP'
  ) THEN
    ALTER TYPE "LeaveType" ADD VALUE 'BUSINESS_TRIP';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'LeaveType' AND e.enumlabel = 'OTHER'
  ) THEN
    ALTER TYPE "LeaveType" ADD VALUE 'OTHER';
  END IF;
END $$;

-- Cột workDays trên attendance
ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "workDays" DOUBLE PRECISION;

-- Cột OT trên leave_requests
ALTER TABLE "leave_requests" ADD COLUMN IF NOT EXISTS "overtimeHours" DOUBLE PRECISION;
ALTER TABLE "leave_requests" ADD COLUMN IF NOT EXISTS "overtimeDate" DATE;
