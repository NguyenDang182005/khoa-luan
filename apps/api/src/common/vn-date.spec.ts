import {
  vnDateString,
  vnDateUtc,
  vnDateFromParts,
  vnMonth,
  vnMonthRange,
} from './vn-date';

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