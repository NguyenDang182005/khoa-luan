import {
  computeBalance,
  computeBaseQuota,
  countWorkdays,
  yearsOfServiceAtYearEnd,
  LeavePolicyConfig,
} from './leave-entitlement';

const defaultPolicy: LeavePolicyConfig = {
  annualQuotaDays: 12,
  seniorityBonusEveryYears: 5,
  seniorityBonusDays: 1,
  prorateByJoinMonth: true,
  maxCarryOverDays: 0,
};

// Lưu ý: tháng trong Date là 0-based — getMonth() 6 = tháng 7
describe('yearsOfServiceAtYearEnd', () => {
  it('đủ năm: join 2020-01-15 → cuối 2026 có 6 năm thâm niên', () => {
    expect(yearsOfServiceAtYearEnd(new Date(2020, 0, 15), 2026)).toBe(6);
  });

  it('chưa tròn kỷ niệm ngày vào: join 2020-07-01 → cuối 2026 mới 6 năm', () => {
    expect(yearsOfServiceAtYearEnd(new Date(2020, 6, 1), 2026)).toBe(6);
  });

  it('vào giữa năm 2026 → cuối 2026 là 0 năm', () => {
    expect(yearsOfServiceAtYearEnd(new Date(2026, 6, 1), 2026)).toBe(0);
  });
});

describe('computeBaseQuota', () => {
  it('nhân viên cũ đủ 5 năm thâm niên: 12 + 1 = 13 ngày', () => {
    const { quota, seniorityBonus, proratedMonths } = computeBaseQuota(
      defaultPolicy,
      new Date(2020, 3, 10),
      2025,
    );
    expect(quota).toBe(13);
    expect(seniorityBonus).toBe(1);
    expect(proratedMonths).toBeNull();
  });

  it('đủ 10 năm: cộng 2 lần mốc = 14 ngày', () => {
    const { quota } = computeBaseQuota(defaultPolicy, new Date(2015, 0, 1), 2025);
    expect(quota).toBe(14);
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

  it('tắt thâm niên (everyYears = 0): không cộng thêm', () => {
    const { quota, seniorityBonus } = computeBaseQuota(
      { ...defaultPolicy, seniorityBonusEveryYears: 0 },
      new Date(2010, 0, 1),
      2025,
    );
    expect(quota).toBe(12);
    expect(seniorityBonus).toBe(0);
  });
});

describe('computeBalance', () => {
  it('không carry-over: total = quota, trừ used', () => {
    const b = computeBalance({
      policy: defaultPolicy,
      joinDate: new Date(2020, 0, 15),
      year: 2026,
      usedThisYear: 4,
      usedPrevYear: 10,
    });
    expect(b.quota).toBe(13);
    expect(b.carryOver).toBe(0);
    expect(b.total).toBe(13);
    expect(b.remaining).toBe(9);
  });

  it('carry-over: năm trước còn 2 → chuyển 2, total = 14', () => {
    const b = computeBalance({
      policy: { ...defaultPolicy, maxCarryOverDays: 3 },
      joinDate: new Date(2020, 0, 15),
      year: 2026,
      usedThisYear: 5,
      usedPrevYear: 10, // quota 2025 = 13 → còn 3
    });
    expect(b.carryOver).toBe(3);
    expect(b.total).toBe(16);
    expect(b.remaining).toBe(11);
  });

  it('carry-over bị chặn bởi maxCarryOverDays', () => {
    const b = computeBalance({
      policy: { ...defaultPolicy, maxCarryOverDays: 2 },
      joinDate: new Date(2020, 0, 15),
      year: 2026,
      usedThisYear: 0,
      usedPrevYear: 0, // còn 13 nhưng chỉ chuyển tối đa 2
    });
    expect(b.carryOver).toBe(2);
    expect(b.total).toBe(15);
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

  it('nhân viên mới vào giữa năm: KHÔNG nhận carry-over từ năm trước khi chưa đi làm', () => {
    const b = computeBalance({
      policy: { ...defaultPolicy, maxCarryOverDays: 5 },
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
