import { PrismaService } from '../prisma/prisma.service';
import { dayKey } from './workdays';

/**
 * Nạp tập ngày lễ trong khoảng [gte, lt) từ bảng `holidays`.
 *
 * Vì sao dùng lt (không bao gồm) và UTC: cột `holidays.date` là @db.Date nên Prisma
 * trả về 00:00 UTC của đúng ngày. Dùng mốc `vnMonthRange` (cũng 00:00 UTC) để không
 * lệch ngày cuối tháng.
 */
export async function loadHolidays(
  prisma: PrismaService,
  gte: Date,
  lt: Date,
): Promise<Set<string>> {
  const rows = await prisma.holiday.findMany({
    where: { date: { gte, lt } },
    select: { date: true },
  });
  return new Set(rows.map((r) => dayKey(r.date)));
}

/** Nạp ngày lễ của một tháng (dùng vnMonthRange để có mốc UTC đúng). */
export async function loadMonthHolidays(
  prisma: PrismaService,
  year: number,
  month: number,
): Promise<Set<string>> {
  const gte = new Date(Date.UTC(year, month - 1, 1));
  const lt = new Date(Date.UTC(year, month, 1));
  return loadHolidays(prisma, gte, lt);
}
