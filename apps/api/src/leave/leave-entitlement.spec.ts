import {
  computeBalance,
  computeBaseQuota,
  countWorkdays,
  LeavePolicyConfig,
} from './leave-entitlement';
import { monthWorkdays } from '../common/workdays';

const defaultPolicy: LeavePolicyConfig = {
  annualQuotaDays: 12,
  seniorityBonusEveryYears: 0,
  seniorityBonusDays: 0,
  prorateByJoinMonth: true,
  maxCarryOverDays: 0,
};

/** Ngày lễ 2026 đủ bộ (theo migration + thông báo Bộ Nội vụ) */
const HOLIDAYS_2026 = new Set([
  '2026-01-01',
  '2026-02-16',
  '2026-02-17',
  '2026-02-18',
  '2026-02-19',
  '2026-02-20',
  '2026-04-26',
  '2026-04-30',
  '2026-05-01',
  '2026-09-01',
  '2026-09-02',
]);

// Lưu ý: tháng trong Date là 0-based — getMonth() 6 = tháng 7
describe('computeBaseQuota', () => {
  it('nhân viên làm đủ năm (kể cả trên 5 năm): giữ nguyên 12 ngày, không cộng phép thâm niên', () => {
    const { quota, seniorityBonus, proratedMonths } = computeBaseQuota(
      defaultPolicy,
      new Date(2020, 3, 10),
      2025,
    );
    expect(quota).toBe(12);
    expect(seniorityBonus).toBe(0);
    expect(proratedMonths).toBeNull();
  });

  it('năm đầu vào tháng 7: pro-rate 12 * 6/12 = 6 ngày', () => {
    const { quota, proratedMonths } = computeBaseQuota(
      defaultPolicy,
      new Date(2026, 6, 1),
      2026,
    );
    expect(quota).toBe(6);
    expect(proratedMonths).toBe(6);
  });

  it('năm đầu vào tháng 12: tính trọn 1 tháng = 1 ngày', () => {
    const { quota } = computeBaseQuota(defaultPolicy, new Date(2026, 11, 15), 2026);
    expect(quota).toBe(1);
  });

  it('tắt pro-rate: nhân viên mới vẫn hưởng đủ', () => {
    const { quota } = computeBaseQuota(
      { ...defaultPolicy, prorateByJoinMonth: false },
      new Date(2026, 6, 1),
      2026,
    );
    expect(quota).toBe(12);
  });
});

describe('computeBalance', () => {
  it('total = quota chuẩn (12 ngày), trừ used, không cộng thêm thâm niên hay chuyển thừa', () => {
    const b = computeBalance({
      policy: defaultPolicy,
      joinDate: new Date(2020, 0, 15),
      year: 2026,
      usedThisYear: 4,
      usedPrevYear: 10,
    });
    expect(b.quota).toBe(12);
    expect(b.carryOver).toBe(0);
    expect(b.seniorityBonus).toBe(0);
    expect(b.total).toBe(12);
    expect(b.remaining).toBe(8);
  });

  it('kể cả khi năm trước còn dư phép vẫn không cộng dồn sang năm sau (total = 12)', () => {
    const b = computeBalance({
      policy: { ...defaultPolicy, maxCarryOverDays: 5 },
      joinDate: new Date(2020, 0, 15),
      year: 2026,
      usedThisYear: 1,
      usedPrevYear: 0,
    });
    expect(b.carryOver).toBe(0);
    expect(b.total).toBe(12);
    expect(b.remaining).toBe(11);
  });

  it('dùng vượt quota → remaining = 0 (không âm)', () => {
    const b = computeBalance({
      policy: defaultPolicy,
      joinDate: new Date(2020, 0, 15),
      year: 2026,
      usedThisYear: 20,
      usedPrevYear: 0,
    });
    expect(b.remaining).toBe(0);
  });

  it('nhân viên mới vào giữa năm: tính theo pro-rate số tháng làm việc thực tế', () => {
    const b = computeBalance({
      policy: defaultPolicy,
      joinDate: new Date(2026, 7, 24), // 24/08/2026
      year: 2026,
      usedThisYear: 0,
      usedPrevYear: 0,
    });
    expect(b.quota).toBe(5); // pro-rate 5 tháng (T8–T12)
    expect(b.carryOver).toBe(0);
    expect(b.total).toBe(5);
  });
});

describe('countWorkdays', () => {
  it('đếm trong tuần: Thứ 2 → Thứ 6 = 5 ngày', () => {
    expect(countWorkdays(new Date(2026, 8, 7), new Date(2026, 8, 11))).toBe(5); // 7-11/9/2026
  });

  it('bao cả cuối tuần: 7 ngày lịch = 5 ngày làm', () => {
    expect(countWorkdays(new Date(2026, 8, 6), new Date(2026, 8, 12))).toBe(5); // CN → Thứ 7
  });

  it('khoảng ngược (to < from) = 0', () => {
    expect(countWorkdays(new Date(2026, 8, 10), new Date(2026, 8, 1))).toBe(0);
  });

  it('đơn vắt qua 2 năm: chỉ đếm phần thuộc năm xét', () => {
    // 30/12/2026 (Thứ 4) → 04/01/2027 (Thứ 2): năm 2026 chiếm 30+31/12 = 2 ngày làm
    expect(countWorkdays(new Date(2026, 11, 30), new Date(2026, 11, 31))).toBe(2);
    expect(countWorkdays(new Date(2027, 0, 1), new Date(2027, 0, 4))).toBe(2); // 01/01 T6 + 04/01 T2
  });
});

describe('countWorkdays — trừ ngày lễ quốc gia', () => {
  it('đơn 01–04/09/2026: 2 ngày lễ (1–2/9) chỉ còn 2 ngày công (3–4/9)', () => {
    expect(
      countWorkdays(new Date(2026, 8, 1), new Date(2026, 8, 4), HOLIDAYS_2026),
    ).toBe(2);
  });

  it('trọn tuần Tết 16–20/02/2026 = 0 ngày công', () => {
    expect(
      countWorkdays(new Date(2026, 1, 16), new Date(2026, 1, 20), HOLIDAYS_2026),
    ).toBe(0);
  });

  it('không truyền ngày lễ thì giữ hành vi cũ (chỉ bỏ T7/CN)', () => {
    expect(countWorkdays(new Date(2026, 8, 1), new Date(2026, 8, 4))).toBe(4);
  });
});

describe('monthWorkdays — số ngày công chuẩn của tháng', () => {
  it('tháng 9/2026: 22 ngày T2–T6, trừ 1–2/9 còn 20', () => {
    expect(monthWorkdays(2026, 9, HOLIDAYS_2026)).toBe(20);
    expect(monthWorkdays(2026, 9)).toBe(22);
  });

  it('tháng 2/2026 có 5 ngày Tết: 20 ngày T2–T6 - 5 = 15', () => {
    expect(monthWorkdays(2026, 2, HOLIDAYS_2026)).toBe(15);
  });
});
