/**
 * Công thức tính phép năm — hàm thuần (không phụ thuộc DB/NestJS) để dễ kiểm thử.
 *
 * Quy ước (đã duyệt trong thiết kế trang Cài Đặt):
 * - Chu kỳ năm phép theo NĂM DƯƠNG LỊCH (1/1 → 31/12), khớp với SalaryConfig hiện có.
 * - Năm đầu làm việc: pro-rate theo số tháng làm việc thực (tháng vào làm tính trọn 1 tháng).
 * - Thâm niên: cộng seniorityBonusDays tại mỗi mốc seniorityBonusEveryYears năm,
 *   tính theo số năm đã làm đủ tính đến 31/12 của năm được xét (0 = tắt).
 * - Carry-over: phép chưa dùng của năm trước được chuyển tối đa maxCarryOverDays
 *   (không cộng dồn chuỗi nhiều năm — chỉ xét đúng 1 năm liền trước, tránh đệ quy).
 */

export interface LeavePolicyConfig {
  annualQuotaDays: number;
  seniorityBonusEveryYears: number;
  seniorityBonusDays: number;
  prorateByJoinMonth: boolean;
  maxCarryOverDays: number;
}

export interface LeaveBalanceBreakdown {
  year: number;
  /** Phép chuẩn năm (đã gồm thâm niên + pro-rate) */
  quota: number;
  /** Phần cộng thâm niên (thành phần của quota) */
  seniorityBonus: number;
  /** Số tháng làm việc dùng để pro-rate (null = không pro-rate) */
  proratedMonths: number | null;
  /** Phép chuyển từ năm trước */
  carryOver: number;
  /** Tổng phép: quota + carryOver */
  total: number;
  /** Đã dùng trong năm (theo ngày chồng lấn, trừ cuối tuần) */
  used: number;
  remaining: number;
}

/** Làm tròn 2 số thập phân để tránh sai số float (13 * 6 / 12 = 6.5...) */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Đếm số ngày làm việc (trừ Thứ 7 + Chủ nhật) trong khoảng [from, to] bao hai đầu */
export function countWorkdays(from: Date, to: Date): number {
  if (to < from) return 0;
  let count = 0;
  const curr = new Date(from);
  curr.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);
  while (curr <= end) {
    const day = curr.getDay();
    if (day !== 0 && day !== 6) count++;
    curr.setDate(curr.getDate() + 1);
  }
  return count;
}

/** Số năm thâm niên trọn vẹn tính đến 31/12 của `year` */
export function yearsOfServiceAtYearEnd(joinDate: Date, year: number): number {
  const end = new Date(year, 11, 31);
  let years = end.getFullYear() - joinDate.getFullYear();
  const beforeAnniversary =
    end.getMonth() < joinDate.getMonth() ||
    (end.getMonth() === joinDate.getMonth() && end.getDate() < joinDate.getDate());
  if (beforeAnniversary) years--;
  return Math.max(0, years);
}

/** Phép chuẩn của 1 năm (chưa gồm carry-over): quota gốc + thâm niên, pro-rate năm đầu */
export function computeBaseQuota(
  policy: LeavePolicyConfig,
  joinDate: Date,
  year: number,
): { quota: number; seniorityBonus: number; proratedMonths: number | null } {
  const years = yearsOfServiceAtYearEnd(joinDate, year);
  const seniorityBonus =
    policy.seniorityBonusEveryYears > 0 && policy.seniorityBonusDays > 0
      ? Math.floor(years / policy.seniorityBonusEveryYears) * policy.seniorityBonusDays
      : 0;

  const base = policy.annualQuotaDays + seniorityBonus;

  const isJoinYear = joinDate.getFullYear() === year;
  if (policy.prorateByJoinMonth && isJoinYear) {
    const proratedMonths = Math.max(1, 12 - joinDate.getMonth()); // tháng vào làm tính trọn
    return { quota: round2((base * proratedMonths) / 12), seniorityBonus, proratedMonths };
  }
  return { quota: base, seniorityBonus, proratedMonths: null };
}

export function computeBalance(params: {
  policy: LeavePolicyConfig;
  joinDate: Date;
  year: number;
  usedThisYear: number;
  usedPrevYear: number;
}): LeaveBalanceBreakdown {
  const { policy, joinDate, year, usedThisYear, usedPrevYear } = params;

  const thisYear = computeBaseQuota(policy, joinDate, year);
  const prevYear = computeBaseQuota(policy, joinDate, year - 1);

  // Carry-over: phần còn lại của năm trước (theo quota năm trước, không cộng dồn chuỗi).
  // Chỉ áp dụng khi nhân viên đã làm việc trong năm liền trước (joinDate <= 31/12 năm trước) —
  // người mới vào giữa năm không "nợ" phép của năm trước đó.
  const workedPrevYear = joinDate.getFullYear() <= year - 1;
  const prevRemaining = workedPrevYear
    ? Math.max(0, prevYear.quota - usedPrevYear)
    : 0;
  const carryOver = Math.min(prevRemaining, policy.maxCarryOverDays);

  const total = round2(thisYear.quota + carryOver);
  const used = round2(usedThisYear);
  return {
    year,
    quota: thisYear.quota,
    seniorityBonus: thisYear.seniorityBonus,
    proratedMonths: thisYear.proratedMonths,
    carryOver,
    total,
    used,
    remaining: Math.max(0, round2(total - used)),
  };
}
