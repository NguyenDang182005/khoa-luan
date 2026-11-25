/**
 * Ngày theo múi giờ Việt Nam (Asia/Ho_Chi_Minh, UTC+7).
 *
 * Vì sao cần: Prisma lưu cột @db.Date theo PHẦN NGÀY UTC của Date JS.
 * Máy chạy server ở UTC+7 nên `new Date(); setHours(0,0,0,0)` tạo ra
 * 2026-09-08T17:00Z cho ngày 09/09 VN → Postgres nhận "2026-09-08".
 * Mọi chỗ tính "hôm nay / tháng này" cho dữ liệu ngày phải đi qua đây.
 */

export const VN_TZ = 'Asia/Ho_Chi_Minh';

/** 'YYYY-MM-DD' của thời điểm `at` theo giờ VN. */
export function vnDateString(at: Date = new Date()): string {
  return at.toLocaleDateString('en-CA', { timeZone: VN_TZ });
}

/** Ngày VN dạng Date mà phần UTC đúng bằng ngày đó (dùng cho cột @db.Date). */
export function vnDateUtc(at: Date = new Date()): Date {
  return new Date(`${vnDateString(at)}T00:00:00.000Z`);
}

/** Ngày VN dạng Date từ 3 số (year, month(1-12), day). */
export function vnDateFromParts(year: number, month: number, day: number): Date {
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return new Date(`${year}-${mm}-${dd}T00:00:00.000Z`);
}

/** Tháng/năm hiện tại theo giờ VN. */
export function vnMonth(at: Date = new Date()): { year: number; month: number } {
  const parts = vnDateString(at).split('-').map(Number);
  return { year: parts[0]!, month: parts[1]! };
}

/** Số phút tính từ 00:00 theo giờ VN (0–1439) — dùng để so mốc đi muộn. */
export function vnMinutesOfDay(at: Date = new Date()): number {
  const [h, m] = at
    .toLocaleTimeString('en-GB', {
      timeZone: VN_TZ,
      hourCycle: 'h23',
      hour: '2-digit',
      minute: '2-digit',
    })
    .split(':')
    .map(Number);
  return ((h ?? 0) % 24) * 60 + (m ?? 0);
}

/** Tạo mốc thời điểm (Date) tại giờ:phút theo múi giờ Việt Nam (+07:00) của ngày `date`. */
export function vnTimeOnDate(date: Date, hour: number, minute = 0): Date {
  const ymd = vnDateString(date);
  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  return new Date(`${ymd}T${hh}:${mm}:00.000+07:00`);
}

/**
 * Khoảng tháng theo giờ VN cho cột @db.Date.
 * Dùng `lt` ngày 1 tháng sau để không lấy nhầm ngày đầu tháng kế tiếp.
 */
export function vnMonthRange(
  year: number,
  month: number,
): { gte: Date; lt: Date } {
  return {
    gte: vnDateFromParts(year, month, 1),
    lt: new Date(Date.UTC(year, month, 1)),
  };
}

/** Khoảng ngày [from, to] (bao hai đầu) dùng cho cột @db.Date. */
export function vnDayRange(from: Date, to: Date): { gte: Date; lte: Date } {
  return { gte: vnDateUtc(from), lte: vnDateUtc(to) };
}