import { PayrollService } from './payroll.service';

/**
 * Kiểm thử đầu-cuối Rule Engine `calculatePayroll` cho kỳ 9/2026 với Prisma giả lập.
 * Số liệu mong đợi tính tay — nếu ai đổi công thức ngày công, OT, bảo hiểm hay thuế,
 * test này báo ngay.
 *
 * Kỳ 9/2026: 22 ngày T2–T6, trừ lễ 1/9 và 2/9 → 20 ngày công chuẩn. Từ 01/7/2026:
 * biểu thuế 5 bậc, trần BHXH 50,6tr, giảm trừ bản thân 15,5tr.
 */
const day = (d: number) => new Date(2026, 8, d);

// 18 ngày đi làm bình thường (bỏ 10/9 nghỉ phép năm, 30/9 vắng)
const WORKED = [3, 4, 7, 8, 9, 11, 14, 15, 16, 17, 18, 21, 22, 23, 24, 25, 28, 29];

function buildPrisma() {
  const attendances = [
    ...WORKED.map((d) => ({
      date: day(d),
      status: 'PRESENT',
      workDays: 1,
      overtime: d === 3 ? 2 : 0, // 2 giờ OT ngày thường
    })),
    // Thứ Bảy 5/9: làm 4 giờ → OT cuối tuần, không tính ngày công
    { date: day(5), status: 'PRESENT', workDays: 0, overtime: 4 },
  ];

  return {
    contract: {
      findFirst: jest.fn().mockResolvedValue({ baseSalary: 20_000_000, allowances: 1_000_000 }),
    },
    salaryConfig: { findFirst: jest.fn().mockResolvedValue(null) }, // dùng mặc định theo luật
    employee: { findUniqueOrThrow: jest.fn().mockResolvedValue({ dependents: 0 }) },
    holiday: {
      findMany: jest.fn().mockResolvedValue([{ date: day(1) }, { date: day(2) }]),
    },
    attendance: { findMany: jest.fn().mockResolvedValue(attendances) },
    leaveRequest: {
      findMany: jest.fn().mockImplementation(({ where }: any) =>
        Promise.resolve(
          where.type?.in?.includes('ANNUAL')
            ? [{ startDate: day(10), endDate: day(10) }] // 1 ngày phép năm đã duyệt
            : [],
        ),
      ),
    },
  };
}

describe('PayrollService.calculatePayroll — kỳ 9/2026', () => {
  it('tính đúng ngày công, OT, bảo hiểm, thuế 5 bậc và thực lĩnh', async () => {
    const service = new PayrollService(buildPrisma() as any, {} as any);

    const r = await service.calculatePayroll('emp-1', 9, 2026, { advance: 500_000 });

    expect(r.workingDays).toBe(20);
    expect(r.actualWorkingDays).toBe(19); // 18 ngày làm + 1 ngày phép năm có lương
    expect(r.baseSalary).toBe(19_000_000); // 20tr / 20 × 19
    expect(r.overtimeHours).toBe(6);
    expect(r.overtimePay).toBe(1_375_000); // 125.000đ/giờ × (2×1,5 + 4×2,0)
    expect([r.bhxh, r.bhyt, r.bhtn]).toEqual([1_600_000, 300_000, 200_000]);
    expect(r._breakdown.personalDeduction).toBe(15_500_000);
    // Chịu thuế = 21.375.000 − 2.100.000 − 15.500.000 = 3.775.000 → 5% = 188.750
    expect(r.tax).toBe(188_750);
    expect(r.netSalary).toBe(18_586_250); // 21.375.000 − 2.100.000 − 188.750 − 500.000
  });

  it('không trích bảo hiểm khi số công dưới 14 ngày', async () => {
    const prisma = buildPrisma();
    prisma.attendance.findMany.mockResolvedValue(
      WORKED.slice(0, 10).map((d) => ({ date: day(d), status: 'PRESENT', workDays: 1, overtime: 0 })),
    );
    const service = new PayrollService(prisma as any, {} as any);

    const r = await service.calculatePayroll('emp-1', 9, 2026);

    expect(r.actualWorkingDays).toBe(11); // 10 ngày làm + 1 ngày phép
    expect(r.deductions).toBe(0);
  });

  it('không cộng trùng 2 lần (200% lương) nếu cùng 1 ngày vừa có chấm công PRESENT vừa có đơn ANNUAL leave đã duyệt', async () => {
    const prisma = buildPrisma();
    // Giả sử ngày 10/9 (đang có đơn ANNUAL leave) nhân viên vẫn đi làm hoặc HR sửa tay thành PRESENT
    prisma.attendance.findMany.mockResolvedValue([
      ...WORKED.map((d) => ({ date: day(d), status: 'PRESENT', workDays: 1, overtime: 0 })),
      { date: day(10), status: 'PRESENT', workDays: 1, overtime: 0 },
    ]);
    const service = new PayrollService(prisma as any, {} as any);

    const r = await service.calculatePayroll('emp-1', 9, 2026);

    // 18 ngày WORKED + ngày 10/9 chỉ tính 1 lần = 19 ngày (không được nhảy lên 20)
    expect(r.actualWorkingDays).toBe(19);
    expect(r._breakdown.paidLeaveDays).toBe(0);
  });

  it('adjust() tính lại thuế TNCN (tax) khi thay đổi thưởng (bonus)', async () => {
    const prisma: Record<string, any> = {
      ...buildPrisma(),
      payroll: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'p-1',
          employeeId: 'emp-1',
          month: 9,
          year: 2026,
          status: 'DRAFT',
          baseSalary: 19_000_000,
          allowances: 1_000_000,
          overtimePay: 1_375_000,
          bonus: 0,
          advance: 500_000,
          deductions: 2_100_000,
          tax: 188_750,
          netSalary: 18_586_250,
        }),
        update: jest.fn().mockImplementation(({ data }: any) => Promise.resolve(data)),
      },
      employee: {
        findUnique: jest.fn().mockResolvedValue({ dependents: 0 }),
      },
    };
    const service = new PayrollService(prisma as any, {} as any);

    // Thêm thưởng 2.000.000 → chịu thuế tăng từ 3.775.000 lên 5.775.000 (vẫn bậc 1: 5%)
    // Thuế mới = 5.775.000 * 5% = 288.750 (tăng 100.000 so với 188.750)
    const updated = await service.adjust('p-1', { bonus: 2_000_000 });

    expect(updated.bonus).toBe(2_000_000);
    expect(updated.tax).toBe(288_750);
    // Thực lĩnh = 23.375.000 - 2.100.000 - 288.750 - 500.000 = 20.486.250
    expect(updated.netSalary).toBe(20_486_250);
  });
});
