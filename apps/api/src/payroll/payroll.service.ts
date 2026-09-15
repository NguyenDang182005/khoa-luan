import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

// Vietnamese PIT (Personal Income Tax) brackets 2024
// Above 11M giảm trừ gia cảnh
const PIT_BRACKETS = [
  { limit: 5_000_000, rate: 0.05 },
  { limit: 10_000_000, rate: 0.10 },
  { limit: 18_000_000, rate: 0.15 },
  { limit: 32_000_000, rate: 0.20 },
  { limit: 52_000_000, rate: 0.25 },
  { limit: 80_000_000, rate: 0.30 },
  { limit: Infinity, rate: 0.35 },
];

function calculatePIT(taxableIncome: number): number {
  if (taxableIncome <= 0) return 0;
  let tax = 0;
  let remaining = taxableIncome;
  let prevLimit = 0;

  for (const bracket of PIT_BRACKETS) {
    const bracketSize = bracket.limit - prevLimit;
    if (remaining <= 0) break;
    const taxable = Math.min(remaining, bracketSize);
    tax += taxable * bracket.rate;
    remaining -= taxable;
    prevLimit = bracket.limit;
  }
  return Math.round(tax);
}

@Injectable()
export class PayrollService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  findAll(month: number, year: number) {
    return this.prisma.payroll.findMany({
      where: { month, year },
      include: {
        employee: {
          select: {
            id: true,
            fullName: true,
            employeeCode: true,
            department: { select: { name: true } },
            position: { select: { title: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  findOne(id: string) {
    return this.prisma.payroll.findUniqueOrThrow({
      where: { id },
      include: { employee: true },
    });
  }

  /** Lịch sử lương mọi kỳ của 1 nhân viên (mới nhất trước) */
  historyByEmployee(employeeId: string) {
    return this.prisma.payroll.findMany({
      where: { employeeId },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
  }

  /** Bảng lương của chính nhân viên đang đăng nhập (resolve Employee từ userId).
   *  month/year bỏ trống → mặc định tháng/năm hiện tại theo múi giờ Việt Nam. */
  async findMyPayroll(userId: string, month?: number, year?: number) {
    const employee = await this.prisma.employee.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!employee) {
      throw new NotFoundException(
        'Người dùng không liên kết với hồ sơ nhân viên',
      );
    }

    // en-CA cho ra định dạng YYYY-MM-DD — lấy tháng/năm hiện tại giờ VN
    const vnToday = new Date().toLocaleDateString('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
    });
    const [vnYear, vnMonth] = vnToday.split('-').map(Number);

    const payroll = await this.prisma.payroll.findFirst({
      where: {
        employeeId: employee.id,
        month: month ?? vnMonth ?? (new Date().getMonth() + 1),
        year: year ?? vnYear ?? new Date().getFullYear(),
      },
      orderBy: { createdAt: 'desc' },
    });

    return { payroll };
  }

  async calculatePayroll(employeeId: string, month: number, year: number) {
    // 1. Get active contract
    const contract = await this.prisma.contract.findFirst({
      where: { employeeId, isActive: true },
      orderBy: { startDate: 'desc' },
    });
    if (!contract) {
      throw new NotFoundException(
        `Nhân viên ${employeeId} chưa có hợp đồng active`,
      );
    }

    // 2. Get salary config for year
    const salaryConfig = await this.prisma.salaryConfig.findFirst({
      where: { year },
      orderBy: { year: 'desc' },
    });
    const config = salaryConfig ?? {
      bhxhRate: 0.08,
      bhytRate: 0.015,
      bhtnRate: 0.01,
      pitFreeAmount: 11_000_000,
      overtimeRate: 1.5,
      otWeekendRate: 2.0,
      otHolidayRate: 3.0,
      standardWorkHours: 8,
    };

    // 3. Get attendance for month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    const attendances = await this.prisma.attendance.findMany({
      where: {
        employeeId,
        date: { gte: startDate, lte: endDate },
        status: { notIn: ['ABSENT'] },
      },
    });

    // 4. Calculate working days (business days in month)
    const workingDays = this.getWorkingDays(year, month);
    const actualWorkingDays = attendances.filter((a) =>
      ['PRESENT', 'LATE', 'HALF_DAY', 'REMOTE'].includes(a.status),
    ).length;

    // 5. Calculate overtime hours
    const overtimeHours = attendances.reduce(
      (sum, a) => sum + (a.overtime ?? 0),
      0,
    );

    // 6. Compute salary components
    const baseSalary = contract.baseSalary;
    const allowances = contract.allowances;
    const dailyRate = baseSalary / workingDays;
    const actualBaseSalary = dailyRate * actualWorkingDays;
    const hourlyRate = baseSalary / (workingDays * config.standardWorkHours);

    // Tính OT phân loại theo ngày
    const overtimeByType = await this.prisma.attendance.groupBy({
      by: ['dayType'],
      where: { employeeId, date: { gte: startDate, lte: endDate }, overtime: { gt: 0 } },
      _sum: { overtime: true },
    });

    const otNormal = overtimeByType.find(o => o.dayType === 'NORMAL')?._sum.overtime ?? 0;
    const otWeekend = overtimeByType.find(o => o.dayType === 'WEEKEND')?._sum.overtime ?? 0;
    const otHoliday = overtimeByType.find(o => o.dayType === 'HOLIDAY')?._sum.overtime ?? 0;

    const overtimePay = hourlyRate * (
      otNormal * config.overtimeRate +
      otWeekend * config.otWeekendRate +
      otHoliday * config.otHolidayRate
    );
    const bonus = 0; // Có thể extend sau

    // 7. Social insurance deductions (on baseSalary, capped at 36M from 2024)
    const siBase = Math.min(baseSalary, 36_000_000);
    const bhxh = Math.round(siBase * config.bhxhRate);
    const bhyt = Math.round(siBase * config.bhytRate);
    const bhtn = Math.round(siBase * config.bhtnRate);
    const totalInsurance = bhxh + bhyt + bhtn;

    // 8. PIT calculation
    const grossIncome = actualBaseSalary + allowances + overtimePay + bonus;
    const taxableIncome = grossIncome - totalInsurance - config.pitFreeAmount;
    const pit = calculatePIT(taxableIncome);

    const deductions = totalInsurance + pit;
    const netSalary = Math.round(grossIncome - deductions);

    return {
      employeeId,
      month,
      year,
      baseSalary: Math.round(actualBaseSalary),
      allowances,
      bonus,
      overtimeHours,
      overtimePay: Math.round(overtimePay),
      deductions,
      tax: pit,
      netSalary,
      workingDays,
      actualWorkingDays,
      // Meta for transparency
      _breakdown: { bhxh, bhyt, bhtn, pit, grossIncome, taxableIncome },
    };
  }

  async generate(employeeId: string, month: number, year: number) {
    const existing = await this.prisma.payroll.findUnique({
      where: { employeeId_month_year: { employeeId, month, year } },
    });
    if (existing && existing.status !== 'DRAFT') {
      throw new BadRequestException(
        'Bảng lương đã được duyệt, không thể tái tạo',
      );
    }

    const { _breakdown, ...data } = await this.calculatePayroll(
      employeeId,
      month,
      year,
    );

    const record = await this.prisma.payroll.upsert({
      where: { employeeId_month_year: { employeeId, month, year } },
      create: { ...data, status: 'DRAFT' },
      update: { ...data, status: 'DRAFT' },
    });

    // `_breakdown` chỉ có trong HTTP response (field `breakdown`),
    // KHÔNG được persist vì model Payroll không có field này.
    return { ...record, breakdown: _breakdown };
  }

  async generateBulk(month: number, year: number) {
    const employees = await this.prisma.employee.findMany({
      where: { status: { in: ['ACTIVE', 'ON_LEAVE'] } },
      select: { id: true },
    });

    const results = await Promise.allSettled(
      employees.map((e) => this.generate(e.id, month, year)),
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;
    return { succeeded, failed, total: employees.length };
  }

  async approve(id: string) {
    return this.prisma.payroll.update({
      where: { id },
      data: { status: 'APPROVED' },
    });
  }

  /** Duyệt hàng loạt: theo kỳ (month/year) hoặc theo danh sách ids.
   *  Chỉ dòng DRAFT được chuyển APPROVED — dòng khác được bỏ qua, không lỗi. */
  async approveBulk(input: { month?: number; year?: number; ids?: string[] }) {
    const where = this.buildBulkWhere(input, 'DRAFT');
    const result = await this.prisma.payroll.updateMany({
      where,
      data: { status: 'APPROVED' },
    });
    return {
      approved: result.count,
      month: input.month ?? null,
      year: input.year ?? null,
    };
  }

  /** Chi trả hàng loạt: chỉ dòng APPROVED chuyển PAID (kèm paidAt). */
  async markPaidBulk(input: { month?: number; year?: number; ids?: string[] }) {
    const where = this.buildBulkWhere(input, 'APPROVED');
    const result = await this.prisma.payroll.updateMany({
      where,
      data: { status: 'PAID', paidAt: new Date() },
    });
    return {
      paid: result.count,
      month: input.month ?? null,
      year: input.year ?? null,
    };
  }

  /** Điều kiện bulk: bắt buộc có (month + year) HOẶC danh sách ids */
  private buildBulkWhere(
    input: { month?: number; year?: number; ids?: string[] },
    fromStatus: 'DRAFT' | 'APPROVED',
  ) {
    const hasIds = Array.isArray(input.ids) && input.ids.length > 0;
    const hasPeriod =
      typeof input.month === 'number' &&
      typeof input.year === 'number' &&
      input.month > 0 &&
      input.month <= 12;
    if (!hasIds && !hasPeriod) {
      throw new BadRequestException(
        'Cần chỉ định tháng/năm hoặc danh sách id bảng lương',
      );
    }
    return hasIds
      ? { id: { in: input.ids! }, status: fromStatus }
      : { month: input.month!, year: input.year!, status: fromStatus };
  }

  async markAsPaid(id: string) {
    return this.prisma.payroll.update({
      where: { id },
      data: { status: 'PAID', paidAt: new Date() },
    });
  }

  /** Count business days (Mon-Fri) in a given month */
  private getWorkingDays(year: number, month: number): number {
    const date = new Date(year, month - 1, 1);
    let count = 0;
    while (date.getMonth() === month - 1) {
      const day = date.getDay();
      if (day !== 0 && day !== 6) count++;
      date.setDate(date.getDate() + 1);
    }
    return count;
  }
}
