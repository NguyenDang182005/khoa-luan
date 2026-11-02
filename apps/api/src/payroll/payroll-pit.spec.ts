import { calculatePit, insuranceCapFor, pitRuleFor } from './pit';

/**
 * Bảo vệ các mốc luật thuế/BHXH đã thay đổi:
 * - Từ kỳ tính thuế 2026: giảm trừ gia cảnh 15,5tr (bản thân) / 6,2tr (người phụ thuộc).
 * - Từ 01/07/2026: biểu thuế 5 bậc (10/30/60/100tr).
 * - Trần đóng BHXH: 46,8tr đến 30/06/2026, 50,6tr từ 01/07/2026.
 */
describe('pitRuleFor — chọn biểu thuế theo kỳ lương', () => {
  it('tháng 6/2026: 7 bậc, giảm trừ 15,5tr (luật 2025 đã có hiệu lực)', () => {
    const rule = pitRuleFor(new Date(2026, 5, 1));
    expect(rule.brackets).toHaveLength(7);
    expect(rule.personalDeduction).toBe(15_500_000);
    expect(rule.dependentDeduction).toBe(6_200_000);
  });

  it('tháng 7/2026: 5 bậc theo Luật Thuế TNCN 2025', () => {
    const rule = pitRuleFor(new Date(2026, 6, 1));
    expect(rule.brackets).toHaveLength(5);
    expect(rule.brackets[0]!.limit).toBe(10_000_000);
    expect(rule.personalDeduction).toBe(15_500_000);
  });

  it('tháng 12/2025: vẫn 11tr giảm trừ (Nghị quyết 110/2025 áp dụng từ kỳ tính thuế 2026)', () => {
    const rule = pitRuleFor(new Date(2025, 11, 1));
    expect(rule.personalDeduction).toBe(11_000_000);
    expect(rule.dependentDeduction).toBe(4_400_000);
  });
});

describe('calculatePit — thuế lũy tiến từng phần', () => {
  it('thu nhập <= 0 → 0', () => {
    expect(calculatePit(0)).toBe(0);
    expect(calculatePit(-5_000_000)).toBe(0);
  });

  describe('biểu 7 bậc (kỳ trước 01/07/2026)', () => {
    const rule = pitRuleFor(new Date(2026, 5, 1));

    it('10 triệu = 5tr×5% + 5tr×10% = 750k', () => {
      expect(calculatePit(10_000_000, rule)).toBe(750_000);
    });

    it('15 triệu = 5tr×5% + 5tr×10% + 5tr×15% = 1,5tr', () => {
      expect(calculatePit(15_000_000, rule)).toBe(1_500_000);
    });

    it('100 triệu = 25,15 triệu', () => {
      expect(calculatePit(100_000_000, rule)).toBe(25_150_000);
    });
  });

  describe('biểu 5 bậc (kỳ từ 01/07/2026)', () => {
    const rule = pitRuleFor(new Date(2026, 6, 1));

    it('10 triệu = 500k (bậc 1 mở rộng đến 10tr)', () => {
      expect(calculatePit(10_000_000, rule)).toBe(500_000);
    });

    it('15 triệu = 10tr×5% + 5tr×10% = 1 triệu', () => {
      expect(calculatePit(15_000_000, rule)).toBe(1_000_000);
    });

    it('100 triệu = 20,5 triệu', () => {
      // 10×5% + 20×10% + 30×20% + 40×30%
      expect(calculatePit(100_000_000, rule)).toBe(20_500_000);
    });

    it('bậc cuối 35% cho phần trên 100 triệu', () => {
      expect(calculatePit(120_000_000, rule)).toBe(
        20_500_000 + 20_000_000 * 0.35,
      );
    });
  });
});

describe('insuranceCapFor — trần đóng BHXH/BHYT', () => {
  it('tháng 6/2026 = 46,8tr (lương cơ sở 2,34tr)', () => {
    expect(insuranceCapFor(new Date(2026, 5, 1))).toBe(46_800_000);
  });

  it('tháng 7/2026 = 50,6tr (lương cơ sở 2,53tr từ 01/07/2026)', () => {
    expect(insuranceCapFor(new Date(2026, 6, 1))).toBe(50_600_000);
  });
});
