/**
 * Tiện ích ngày làm việc theo lịch Việt Nam — hàm thuần, không phụ thuộc NestJS/Prisma.
 *
 * Quy ước:
 * - Ngày nghỉ hằng tuần: Thứ 7 + Chủ nhật.
 * - Ngày lễ quốc gia: đọc từ bảng `holidays`, truyền vào dưới dạng Set 'YYYY-MM-DD'
 *   (xem `common/holidays.ts`). Ngày lễ là ngày NGHỈ CÓ LƯƠNG: không bị trừ công,
 *   không bị tính vào phép năm, và tăng ca ngày lễ hưởng hệ số 3x.
 * - Mọi hàm dùng phần ngày theo giờ máy chủ (server chạy Asia/Ho_Chi_Minh) — khớp
 *   với cách Prisma trả cột @db.Date (00:00 UTC, cùng ngày ở VN).
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export type AttendanceDayType = 'NORMAL' | 'WEEKEND' | 'HOLIDAY';

/** Chuẩn hóa Date về 00:00:00.000Z của đúng ngày lịch (hỗ trợ cả @db.Date 00:00 UTC lẫn new Date(y,m,d) local). */
function toUtcMidnight(d: Date): Date {
  if (
    d.getUTCHours() === 0 &&
    d.getUTCMinutes() === 0 &&
    d.getUTCSeconds() === 0 &&
    d.getUTCMilliseconds() === 0
  ) {
    return new Date(d.getTime());
  }
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

/** 'YYYY-MM-DD' của một Date (không phụ thuộc TZ của máy chủ). */
export function dayKey(d: Date): string {
  const u = toUtcMidnight(d);
  const y = u.getUTCFullYear();
  const m = String(u.getUTCMonth() + 1).padStart(2, '0');
  const day = String(u.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function isWeekend(d: Date): boolean {
  const dow = toUtcMidnight(d).getUTCDay();
  return dow === 0 || dow === 6;
}

/** Phân loại một ngày: nghỉ lễ > cuối tuần > ngày thường. */
export function dayTypeFor(
  d: Date,
  holidays?: ReadonlySet<string>,
): AttendanceDayType {
  if (holidays?.has(dayKey(d))) return 'HOLIDAY';
  if (isWeekend(d)) return 'WEEKEND';
  return 'NORMAL';
}

/** Đếm số ngày làm việc trong [from, to] (bao hai đầu), trừ cuối tuần + ngày lễ. */
export function countWorkdays(
  from: Date,
  to: Date,
  holidays?: ReadonlySet<string>,
): number {
  const start = toUtcMidnight(from);
  const end = toUtcMidnight(to);
  if (end < start) return 0;

  let count = 0;
  for (let ts = start.getTime(); ts <= end.getTime(); ts += DAY_MS) {
    const cur = new Date(ts);
    if (!isWeekend(cur) && !holidays?.has(dayKey(cur))) count++;
  }
  return count;
}

/** Số ngày làm việc của tháng `month` (1–12), trừ cuối tuần + ngày lễ. */
export function monthWorkdays(
  year: number,
  month: number,
  holidays?: ReadonlySet<string>,
): number {
  return countWorkdays(
    new Date(Date.UTC(year, month - 1, 1)),
    new Date(Date.UTC(year, month, 0)),
    holidays,
  );
}

/** Danh sách các ngày (00:00 UTC) trong [from, to] (bao hai đầu). */
export function eachDay(from: Date, to: Date): Date[] {
  const days: Date[] = [];
  const start = toUtcMidnight(from);
  const end = toUtcMidnight(to);
  for (let ts = start.getTime(); ts <= end.getTime(); ts += DAY_MS) {
    days.push(new Date(ts));
  }
  return days;
}
