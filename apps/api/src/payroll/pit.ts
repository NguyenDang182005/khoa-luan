import { dayKey } from '../common/workdays';

/**
 * Quy tắc thuế TNCN + trần đóng BHXH của Việt Nam, có hiệu lực theo thời điểm.
 *
 * Vì sao phải có mốc thời gian: luật thay đổi giữa các năm. Hardcode một bảng duy nhất
 * (như bản cũ: 7 bậc + giảm trừ 11tr) làm mọi phiếu lương sai kể từ 2025.
 *
 * Mốc đang dùng:
 * - 01/01/2020: 7 bậc; giảm trừ bản thân 11tr, người phụ thuộc 4,4tr.
 * - 01/01/2026: giữ 7 bậc; nâng giảm trừ lên 15,5tr / 6,2tr (Nghị quyết 110/2025/UBTVQH15,
 *   áp dụng từ kỳ tính thuế 2026).
 * - 01/07/2026: Luật Thuế TNCN 2025 — biểu thuế còn 5 bậc (10/30/60/100tr),
 *   giảm trừ giữ 15,5tr / 6,2tr.
 *
 * Trần đóng BHXH/BHYT = 20 lần mức lương cơ sở:
 * - 1,8tr  → 36tr     (trước 01/07/2023)
 * - 2,34tr → 46,8tr   (01/07/2023 – 30/06/2026)
 * - 2,53tr → 50,6tr   (từ 01/07/2026)
 */

export interface PitBracket {
  /** Trần thu nhập chịu thuế của bậc (Infinity cho bậc cuối) */
  limit: number;
  rate: number;
}

export interface PitRule {
  /** Ngày bắt đầu hiệu lực 'YYYY-MM-DD' */
  from: string;
  personalDeduction: number;
  dependentDeduction: number;
  brackets: PitBracket[];
}

const BRACKETS_7: PitBracket[] = [
  { limit: 5_000_000, rate: 0.05 },
  { limit: 10_000_000, rate: 0.1 },
  { limit: 18_000_000, rate: 0.15 },
  { limit: 32_000_000, rate: 0.2 },
  { limit: 52_000_000, rate: 0.25 },
  { limit: 80_000_000, rate: 0.3 },
  { limit: Infinity, rate: 0.35 },
];

const BRACKETS_5: PitBracket[] = [
  { limit: 10_000_000, rate: 0.05 },
  { limit: 30_000_000, rate: 0.1 },
  { limit: 60_000_000, rate: 0.2 },
  { limit: 100_000_000, rate: 0.3 },
  { limit: Infinity, rate: 0.35 },
];

export const PIT_RULES: PitRule[] = [
  {
    from: '2020-01-01',
    personalDeduction: 11_000_000,
    dependentDeduction: 4_400_000,
    brackets: BRACKETS_7,
  },
  {
    from: '2026-01-01',
    personalDeduction: 15_500_000,
    dependentDeduction: 6_200_000,
    brackets: BRACKETS_7,
  },
  {
    from: '2026-07-01',
    personalDeduction: 15_500_000,
    dependentDeduction: 6_200_000,
    brackets: BRACKETS_5,
  },
];

/** Cấu hình lương mặc định khi năm chưa có bản ghi SalaryConfig — giảm trừ lấy theo luật
 *  của kỳ lương, dùng chung cho Rule Engine và trang Cài Đặt để hai nơi không lệch nhau. */
export function defaultSalaryConfigFor(period: Date) {
  const rule = pitRuleFor(period);
  return {
    bhxhRate: 0.08,
    bhytRate: 0.015,
    bhtnRate: 0.01,
    pitFreeAmount: rule.personalDeduction,
    pitDependentDeduction: rule.dependentDeduction,
    overtimeRate: 1.5,
    otWeekendRate: 2.0,
    otHolidayRate: 3.0,
    standardWorkHours: 8,
  };
}

/** Quy tắc áp dụng cho kỳ lương có ngày bắt đầu `period` (thường là ngày 1 của tháng). */
export function pitRuleFor(period: Date): PitRule {
  const key = dayKey(period);
  let rule = PIT_RULES[0]!;
  for (const candidate of PIT_RULES) {
    if (key >= candidate.from) rule = candidate;
  }
  return rule;
}

/** Thuế TNCN lũy tiến từng phần trên `taxableIncome` theo biểu thuế của `rule`. */
export function calculatePit(
  taxableIncome: number,
  rule: PitRule = PIT_RULES[PIT_RULES.length - 1]!,
): number {
  if (!Number.isFinite(taxableIncome) || taxableIncome <= 0) return 0;

  let tax = 0;
  let remaining = taxableIncome;
  let prevLimit = 0;

  for (const bracket of rule.brackets) {
    if (remaining <= 0) break;
    const bracketSize = bracket.limit - prevLimit;
    const taxable = Math.min(remaining, bracketSize);
    tax += taxable * bracket.rate;
    remaining -= taxable;
    prevLimit = bracket.limit;
  }
  return Math.round(tax);
}

const SI_CAP_PERIODS: { from: string; cap: number }[] = [
  { from: '2000-01-01', cap: 36_000_000 },
  { from: '2023-07-01', cap: 46_800_000 },
  { from: '2026-07-01', cap: 50_600_000 },
];

/** Trần tiền lương tháng đóng BHXH/BHYT tại thời điểm `period`. */
export function insuranceCapFor(period: Date): number {
  const key = dayKey(period);
  let cap = SI_CAP_PERIODS[0]!.cap;
  for (const periodCap of SI_CAP_PERIODS) {
    if (key >= periodCap.from) cap = periodCap.cap;
  }
  return cap;
}
