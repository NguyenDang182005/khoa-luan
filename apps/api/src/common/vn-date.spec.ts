import {
  vnDateString,
  vnDateUtc,
  vnDateFromParts,
  vnMonth,
  vnMonthRange,
  vnMinutesOfDay,
  vnTimeOnDate,
} from './vn-date';
import { dayKey, isWeekend, countWorkdays, eachDay, dayTypeFor } from './workdays';

describe('vnDateString', () => {
  it('lấy ngày theo giờ VN, không lệch sang hôm trước', () => {
    // 2026-09-09T01:47:00Z = 08:47 VN ngày 09/09 → phải ra 09, không phải 08
    expect(vnDateString(new Date('2026-09-09T01:47:00Z'))).toBe('2026-09-09');
  });

  it('sau nửa đêm VN vẫn ra đúng ngày đó', () => {
    // 2026-09-08T17:30:00Z = 00:30 VN ngày 09/09
    expect(vnDateString(new Date('2026-09-08T17:30:00Z'))).toBe('2026-09-09');
  });
});

describe('vnDateUtc', () => {
  it('phần ngày UTC bằng đúng ngày VN (đây là điều Prisma @db.Date lưu)', () => {
    const d = vnDateUtc(new Date('2026-09-09T01:47:00Z'));
    expect(d.toISOString()).toBe('2026-09-09T00:00:00.000Z');
    expect(d.toISOString().slice(0, 10)).toBe('2026-09-09');
  });

  it('vnDateFromParts dựng đúng ngày UTC', () => {
    expect(vnDateFromParts(2026, 9, 9).toISOString()).toBe('2026-09-09T00:00:00.000Z');
  });
});

describe('vnMonth', () => {
  it('tháng/năm theo giờ VN khi UTC đã sang ngày mới', () => {
    // 2026-10-01T01:00:00Z = 08:00 VN ngày 01/10
    expect(vnMonth(new Date('2026-10-01T01:00:00Z'))).toEqual({
      year: 2026,
      month: 10,
    });
  });
});

describe('vnMonthRange', () => {
  it('gte = ngày 1, lt = ngày 1 tháng sau (không lấy lẫn tháng kế tiếp)', () => {
    const { gte, lt } = vnMonthRange(2026, 9);
    expect(gte.toISOString().slice(0, 10)).toBe('2026-09-01');
    expect(lt.toISOString().slice(0, 10)).toBe('2026-10-01');
  });

  it('tháng 12 vẫn sang đúng năm sau', () => {
    const { lt } = vnMonthRange(2026, 12);
    expect(lt.toISOString().slice(0, 10)).toBe('2027-01-01');
  });
});

describe('vnMinutesOfDay & vnTimeOnDate', () => {
  it('vnTimeOnDate luôn dựng đúng mốc +07:00 bất kể TZ máy chủ', () => {
    const date = vnDateFromParts(2026, 9, 9);
    const eightAm = vnTimeOnDate(date, 8, 0);
    // 08:00 VN = 01:00 UTC
    expect(eightAm.toISOString()).toBe('2026-09-09T01:00:00.000Z');
    expect(vnMinutesOfDay(eightAm)).toBe(8 * 60);
  });

  it('vnMinutesOfDay tại 00:05 VN trả về 5 (không bị 24*60 = 1440)', () => {
    const midnightPlus5 = new Date('2026-09-09T00:05:00.000+07:00');
    expect(vnMinutesOfDay(midnightPlus5)).toBe(5);
  });
});

describe('workdays — xử lý đồng nhất trên @db.Date (00:00 UTC)', () => {
  it('dayKey và eachDay giữ nguyên 00:00 UTC cho các mốc @db.Date', () => {
    const start = vnDateFromParts(2026, 9, 7); // T2
    const end = vnDateFromParts(2026, 9, 9); // T4
    const days = eachDay(start, end);
    expect(days.map((d) => d.toISOString())).toEqual([
      '2026-09-07T00:00:00.000Z',
      '2026-09-08T00:00:00.000Z',
      '2026-09-09T00:00:00.000Z',
    ]);
    expect(days.map(dayKey)).toEqual(['2026-09-07', '2026-09-08', '2026-09-09']);
    expect(countWorkdays(start, end)).toBe(3);
  });

  it('isWeekend và dayTypeFor phân loại đúng T7/CN và ngày lễ từ @db.Date', () => {
    const sat = vnDateFromParts(2026, 9, 5);
    const wedHoliday = vnDateFromParts(2026, 9, 2);
    const holidays = new Set(['2026-09-02']);
    expect(isWeekend(sat)).toBe(true);
    expect(dayTypeFor(sat, holidays)).toBe('WEEKEND');
    expect(dayTypeFor(wedHoliday, holidays)).toBe('HOLIDAY');
  });
});