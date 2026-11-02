-- =====================================================================
-- Fix lỗi "logic chưa sát thực tế" (audit 30/10/2026)
-- 1) Ngày công có thể lẻ (đi muộn/về sớm, nghỉ nửa ngày) → Float
-- 2) Tách khấu trừ: deductions chỉ còn BHXH/BHYT/BHTN (thuế TNCN là cột riêng)
-- 3) Thêm trợ cấp BHXH (ốm đau/thai sản) + tạm ứng vào bảng lương
-- 4) Người phụ thuộc + mức giảm trừ gia cảnh 15,5tr / 6,2tr (Luật TNCN 2025)
-- 5) Bảng ngày lễ quốc gia (nghỉ có lương) + dữ liệu 2026
-- 6) escalatedAt cho phiên CSKH (phân biệt escalate với phiên đóng do qua ngày)
-- =====================================================================

-- ── 1. Ngày công lẻ ──────────────────────────────────────────────────
ALTER TABLE "payrolls"
  ALTER COLUMN "actualWorkingDays" SET DATA TYPE DOUBLE PRECISION;

-- ── 2/3. Cột bảo hiểm, trợ cấp BHXH, tạm ứng ─────────────────────────
ALTER TABLE "payrolls"
  ADD COLUMN "advance" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "bhxh" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "bhyt" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "bhtn" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "bhxhBenefit" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Dòng do PayrollService cũ tạo: deductions = bảo hiểm + thuế, net = gross - deductions.
-- Dòng do seed tạo: deductions = bảo hiểm, net = gross - deductions - tax.
-- Chỉ dòng loại đầu cần bỏ thuế ra khỏi deductions để về đúng nghĩa "khấu trừ bảo hiểm".
UPDATE "payrolls"
SET "deductions" = GREATEST(0, "deductions" - "tax")
WHERE "tax" > 0
  AND ABS("netSalary" - ("baseSalary" + "allowances" + "overtimePay" + "bonus" - "deductions")) < 1;

-- Tách BHXH/BHYT/BHTN cho dòng cũ theo tỷ lệ NLĐ 8% / 1,5% / 1% (tổng 10,5%)
UPDATE "payrolls"
SET "bhxh" = ROUND(("deductions" * 8.0 / 10.5)::numeric, 0)::double precision,
    "bhyt" = ROUND(("deductions" * 1.5 / 10.5)::numeric, 0)::double precision,
    "bhtn" = GREATEST(
      0,
      "deductions"
        - ROUND(("deductions" * 8.0 / 10.5)::numeric, 0)::double precision
        - ROUND(("deductions" * 1.5 / 10.5)::numeric, 0)::double precision
    )
WHERE "deductions" > 0 AND "bhxh" = 0;

-- ── 4. Giảm trừ gia cảnh ────────────────────────────────────────────
ALTER TABLE "employees" ADD COLUMN "dependents" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "salary_configs"
  ADD COLUMN "pitDependentDeduction" DOUBLE PRECISION NOT NULL DEFAULT 6200000;
ALTER TABLE "salary_configs" ALTER COLUMN "pitFreeAmount" SET DEFAULT 15500000;
UPDATE "salary_configs" SET "pitFreeAmount" = 15500000 WHERE "pitFreeAmount" = 11000000;

-- ── 5. Ngày lễ quốc gia ─────────────────────────────────────────────
CREATE TABLE "holidays" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "holidays_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "holidays_date_key" ON "holidays"("date");

-- Lịch nghỉ 2026 theo thông báo của Bộ Nội vụ (Tết 16–20/2, Quốc khánh 1–2/9).
-- Giỗ Tổ 10/3 âm lịch = 26/4/2026. HR có thể sửa qua API /settings/holidays.
INSERT INTO "holidays" ("id", "date", "name") VALUES
  ('holiday-2026-01-01', '2026-01-01', 'Tết Dương lịch'),
  ('holiday-2026-02-16', '2026-02-16', 'Tết Nguyên Đán (29 tháng Chạp)'),
  ('holiday-2026-02-17', '2026-02-17', 'Tết Nguyên Đán (mùng 1)'),
  ('holiday-2026-02-18', '2026-02-18', 'Tết Nguyên Đán (mùng 2)'),
  ('holiday-2026-02-19', '2026-02-19', 'Tết Nguyên Đán (mùng 3)'),
  ('holiday-2026-02-20', '2026-02-20', 'Tết Nguyên Đán (mùng 4)'),
  ('holiday-2026-04-26', '2026-04-26', 'Giỗ Tổ Hùng Vương (10/3 âm lịch)'),
  ('holiday-2026-04-30', '2026-04-30', 'Ngày Giải phóng miền Nam'),
  ('holiday-2026-05-01', '2026-05-01', 'Ngày Quốc tế Lao động'),
  ('holiday-2026-09-01', '2026-09-01', 'Nghỉ liền kề Quốc khánh'),
  ('holiday-2026-09-02', '2026-09-02', 'Quốc khánh')
ON CONFLICT ("date") DO NOTHING;

-- ── 6. Escalation ───────────────────────────────────────────────────
ALTER TABLE "ai_chat_sessions" ADD COLUMN "escalatedAt" TIMESTAMP(3);

-- Backfill từ dữ liệu thật: n8n lưu metadata.escalated = true trên message.
-- Không suy từ isActive=false vì phiên đóng do qua ngày cũng isActive=false.
UPDATE "ai_chat_sessions" s
SET "escalatedAt" = sub."firstEscalatedAt"
FROM (
  SELECT "sessionId", MIN("createdAt") AS "firstEscalatedAt"
  FROM "ai_chat_messages"
  WHERE "metadata"->>'escalated' = 'true'
  GROUP BY "sessionId"
) sub
WHERE s."id" = sub."sessionId" AND s."escalatedAt" IS NULL;
