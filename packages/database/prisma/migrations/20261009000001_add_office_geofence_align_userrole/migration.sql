-- #9: OfficeGeofence vào schema nhưng thiếu migration (chấm công GPS chưa lưu được)
CREATE TABLE "office_geofences" (
    "id" TEXT NOT NULL,
    "name" TEXT DEFAULT 'Văn phòng công ty',
    "lat" DOUBLE PRECISION DEFAULT 10.7951,
    "lng" DOUBLE PRECISION DEFAULT 106.7218,
    "radiusM" DOUBLE PRECISION DEFAULT 200,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "office_geofences_pkey" PRIMARY KEY ("id")
);

-- #9: schema.prisma chỉ còn 2 giá trị UserRole nhưng DB đang có 5
-- (ADMIN, HR_MANAGER, MANAGER, EMPLOYEE, HR_ADMIN). Postgres không cho DROP VALUE trong
-- enum cũ → tạo type mới, remap role cũ về ADMIN/EMPLOYEE, đổi tên lại.
-- Xem: bảng users.role = 'HR_ADMIN'/'HR_MANAGER'/'MANAGER' → 'ADMIN' (đã refactor 2-role).
CREATE TYPE "UserRole_new" AS ENUM ('ADMIN', 'EMPLOYEE');

-- Bỏ DEFAULT trước khi đổi type: Postgres không tự cast default cũ sang enum mới
-- (lỗi "default for column role cannot be cast automatically" trên DB trống).
ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;

ALTER TABLE "users"
  ALTER COLUMN "role" TYPE "UserRole_new"
  USING (
    CASE "role"
      WHEN 'HR_ADMIN' THEN 'ADMIN'
      WHEN 'HR_MANAGER' THEN 'ADMIN'
      WHEN 'MANAGER' THEN 'ADMIN'
      WHEN 'ADMIN' THEN 'ADMIN'
      WHEN 'EMPLOYEE' THEN 'EMPLOYEE'
      ELSE 'EMPLOYEE'
    END
  )::"UserRole_new";

DROP TYPE "UserRole";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";

ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'EMPLOYEE'::"UserRole";