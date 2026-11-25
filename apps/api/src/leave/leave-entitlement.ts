/**
 * Công thức tính phép năm — hàm thuần (không phụ thuộc DB/NestJS) để dễ kiểm thử.
 *
 * Quy ước (đã duyệt trong thiết kế trang Cài Đặt):
 * - Chu kỳ năm phép theo NĂM DƯƠNG LỊCH (1/1 → 31/12), khớp với SalaryConfig hiện có.
 * - Năm đầu làm việc: pro-rate theo số tháng làm việc thực (tháng vào làm tính trọn 1 tháng).
 * - Không áp dụng bất kỳ cơ chế cộng thêm ngày phép nào khác (seniorityBonus = 0, carryOver = 0).
 */

// Re-export để test cũ và nơi khác vẫn import từ module này.
export { countWorkdays } from '../common/workdays';

export interface LeavePolicyConfig {
  annualQuotaDays: number;
  seniorityBonusEveryYears?: number;
  seniorityBonusDays?: number;
  prorateByJoinMonth: boolean;
  maxCarryOverDays?: number;
}

export interface LeaveBalanceBreakdown {
  year: number;
  /** Phép chuẩn năm (đã gồm pro-rate nếu vào làm trong năm) */
  quota: number;
  /** Phần cộng thâm niên (luôn bằng 0 theo chính sách hiện hành) */
  seniorityBonus: number;
  /** Số tháng làm việc dùng để pro-rate (null = không pro-rate) */
  proratedMonths: number | null;
  /** Phép chuyển từ năm trước (luôn bằng 0 theo chính sách hiện hành) */
  carryOver: number;
  /** Tổng phép năm (= quota) */
  total: number;
  /** Đã dùng trong năm (theo ngày chồng lấn, trừ cuối tuần) */
  used: number;
  remaining: number;
}

/** Làm tròn 2 số thập phân để tránh sai số float (13 * 6 / 12 = 6.5...) */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Phép chuẩn của 1 năm (chưa gồm carry-over): quota gốc, pro-rate năm đầu (không cộng phép thâm niên) */
export function computeBaseQuota(
  policy: LeavePolicyConfig,
  joinDate: Date,
  year: number,
): { quota: number; seniorityBonus: number; proratedMonths: number | null } {
  const seniorityBonus = 0;
  const base = policy.annualQuotaDays;

  const joinYear =
    joinDate.getUTCHours() === 0 && joinDate.getUTCMinutes() === 0
      ? joinDate.getUTCFullYear()
      : joinDate.getFullYear();
  const joinMonth =
    joinDate.getUTCHours() === 0 && joinDate.getUTCMinutes() === 0
      ? joinDate.getUTCMonth()
      : joinDate.getMonth();

  if (year < joinYear) {
    return { quota: 0, seniorityBonus: 0, proratedMonths: 0 };
  }

  const isJoinYear = joinYear === year;
  if (policy.prorateByJoinMonth && isJoinYear) {
    const proratedMonths = Math.max(1, 12 - joinMonth); // tháng vào làm tính trọn
    return { quota: round2((base * proratedMonths) / 12), seniorityBonus, proratedMonths };
  }
  return { quota: base, seniorityBonus, proratedMonths: null };
}

export function computeBalance(params: {
  policy: LeavePolicyConfig;
  joinDate: Date;
  year: number;
  usedThisYear: number;
  usedPrevYear?: number;
}): LeaveBalanceBreakdown {
  const { policy, joinDate, year, usedThisYear } = params;

  const thisYear = computeBaseQuota(policy, joinDate, year);
  const carryOver = 0;

  const total = round2(thisYear.quota);
  const used = round2(usedThisYear);
  return {
    year,
    quota: thisYear.quota,
    seniorityBonus: 0,
    proratedMonths: thisYear.proratedMonths,
    carryOver,
    total,
    used,
    remaining: Math.max(0, round2(total - used)),
  };
}
