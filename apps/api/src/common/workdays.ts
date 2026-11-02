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

export type AttendanceDayType = 'NORMAL' | 'WEEKEND' | 'HOLIDAY';

/** 'YYYY-MM-DD' của một Date (theo phần ngày địa phương). */
export function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function isWeekend(d: Date): boolean {
  const dow = d.getDay();
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
  const start = new Date(from);
  start.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);
  if (end < start) return 0;

  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    if (!isWeekend(cur) && !holidays?.has(dayKey(cur))) count++;
    cur.setDate(cur.getDate() + 1);
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
    new Date(year, month - 1, 1),
    new Date(year, month, 0),
    holidays,
  );
}

/** Danh sách các ngày trong [from, to] (bao hai đầu). */
export function eachDay(from: Date, to: Date): Date[] {
  const days: Date[] = [];
  const cur = new Date(from);
  cur.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);
  while (cur <= end) {
    days.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}
