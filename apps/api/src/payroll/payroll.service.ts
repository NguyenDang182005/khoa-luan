import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { vnDateFromParts, vnMonth, vnMonthRange } from '../common/vn-date';
import { countWorkdays, dayKey, dayTypeFor, eachDay, monthWorkdays } from '../common/workdays';
import { loadHolidays } from '../common/holidays';
import { workDaysFromTimestamps } from '../attendance/attendance.service';
import { calculatePit, defaultSalaryConfigFor, insuranceCapFor, pitRuleFor } from './pit';

/** Tỷ lệ hưởng trợ cấp BHXH (do cơ quan BHXH chi trả, không phải lương công ty) */
const SICK_BENEFIT_RATE = 0.75; // ốm đau: 75% mức tiền lương đóng BHXH
const MATERNITY_BENEFIT_RATE = 1.0; // thai sản: 100%
const DAY_MS = 24 * 60 * 60 * 1000;

export interface PayrollOptions {
  /** Thưởng nhập tay của kỳ (giữ nguyên khi tái tạo DRAFT) */
  bonus?: number;
  /** Tạm ứng đã trừ trong kỳ */
  advance?: number;
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

    const now = vnMonth();

    const payroll = await this.prisma.payroll.findFirst({
      where: {
        employeeId: employee.id,
        month: month ?? now.month,
        year: year ?? now.year,
      },
      orderBy: { createdAt: 'desc' },
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
    });

    return { payroll };
  }

  /**
   * Tính lương một nhân viên cho kỳ `month/year` (không ghi DB).
   *
   * Quy ước nghiệp vụ (sát luật VN):
   * - Ngày công = ngày làm việc T2–T6, TRỪ ngày lễ quốc gia (nghỉ có lương).
   * - Ngày phép năm (ANNUAL) đã duyệt: vẫn trả lương, không bị trừ công.
   * - Nghỉ ốm (SICK) / thai sản (MATERNITY): công ty KHÔNG trả lương — BHXH trả 75% / 100%,
   *   ghi nhận ở `bhxhBenefit` để hiển thị, không cộng vào net của công ty.
   * - Làm cuối tuần / ngày lễ: toàn bộ giờ là tăng ca (2x / 3x), không cộng vào ngày công.
   * - Tăng ca: lấy max(giờ chấm công, giờ đơn OT đã duyệt) theo từng ngày.
   * - `deductions` = BHXH + BHYT + BHTN (thuế TNCN là cột riêng `tax`).
   * - Thuế TNCN theo biểu thuế hiệu lực của kỳ lương + giảm trừ người phụ thuộc.
   */
  async calculatePayroll(
    employeeId: string,
    month: number,
    year: number,
    options: PayrollOptions = {},
  ) {
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      throw new BadRequestException('Tháng không hợp lệ (1–12)');
    }
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      throw new BadRequestException('Năm không hợp lệ');
    }

    const period = vnDateFromParts(year, month, 1);
    const { gte: startDate, lt: endDate } = vnMonthRange(year, month);

    const [contract, salaryConfig, employee, holidays] = await Promise.all([
      // Hợp đồng HIỆU LỰC TRONG KỲ (ưu tiên hợp đồng đang active để không bốc nhầm
      // hợp đồng tạo nhầm đã bị deactivate; tính lại lương tháng cũ của người đã nghỉ việc
      // vẫn lấy được hợp đồng lúc đó).
      this.prisma.contract.findFirst({
        where: {
          employeeId,
          startDate: { lt: endDate },
          OR: [{ endDate: null }, { endDate: { gte: startDate } }],
        },
        orderBy: [{ isActive: 'desc' }, { startDate: 'desc' }],
      }),
      this.prisma.salaryConfig.findFirst({
        where: { year: { lte: year } },
        orderBy: { year: 'desc' },
      }),
      this.prisma.employee.findUniqueOrThrow({
        where: { id: employeeId },
        select: { dependents: true },
      }),
      loadHolidays(this.prisma, startDate, endDate),
    ]);

    if (!contract) {
      throw new NotFoundException(
        `Nhân viên ${employeeId} chưa có hợp đồng hiệu lực trong kỳ ${month}/${year}`,
      );
    }
    const config = salaryConfig ?? defaultSalaryConfigFor(period);

    // ── 1. Chấm công trong tháng ────────────────────────────────────────
    const attendances = await this.prisma.attendance.findMany({
      where: {
        employeeId,
        date: { gte: startDate, lt: endDate },
        status: { notIn: ['ABSENT'] },
      },
    });

    // ── 2. Ngày công thực tế ────────────────────────────────────────────
    const workingDays = monthWorkdays(year, month, holidays);
    if (workingDays <= 0) {
      throw new BadRequestException(
        `Tháng ${month}/${year} không có ngày làm việc`,
      );
    }

    let actualWorkingDays = 0;
    const workedDayKeys = new Set<string>();
    for (const a of attendances) {
      if (a.status === 'ON_LEAVE') continue; // tính qua đơn nghỉ có lương bên dưới
      const dayType = dayTypeFor(a.date, holidays);
      if (dayType !== 'NORMAL') continue; // cuối tuần/lễ: chỉ tính tăng ca
      // Nếu bản ghi có đủ giờ checkIn và checkOut thật (không phải HALF_DAY sửa tay),
      // tính trực tiếp từ [checkIn, checkOut] theo 2 ca (08:00-12:00 & 13:30-17:30) / 480
      // để luôn chính xác kể cả với bản ghi cũ trước đây từng bị làm tròn 0.25.
      const days =
        a.checkIn && a.checkOut && a.status !== 'HALF_DAY'
          ? workDaysFromTimestamps(a.date, a.checkIn, a.checkOut)
          : a.workDays !== null && a.workDays !== undefined
            ? a.workDays
            : a.checkIn && !a.checkOut
              ? 0 // mới check-in, chưa check-out → chưa chốt công
              : a.status === 'HALF_DAY'
                ? 0.5
                : 1;
      if (days > 0) workedDayKeys.add(dayKey(a.date));
      actualWorkingDays += days;
    }

    // Ngày công trả lương theo đơn: phép năm và đi công tác (vẫn là đang làm việc).
    // Loại trừ những ngày đã được tính công trực tiếp trong `attendances` để không bao giờ cộng trùng 2 lần.
    const paidLeaveDays = await this.countLeaveDays(
      employeeId,
      year,
      month,
      ['ANNUAL', 'BUSINESS_TRIP'],
      holidays,
      workedDayKeys,
    );
    actualWorkingDays += paidLeaveDays;
    actualWorkingDays = Math.min(workingDays, Math.round(actualWorkingDays * 10000) / 10000);

    // ── 3. Nghỉ ốm / thai sản (BHXH chi trả) ────────────────────────────
    const sickDays = await this.countLeaveDays(
      employeeId,
      year,
      month,
      ['SICK'],
      holidays,
    );
    // Thai sản gồm cả lao động nam nghỉ khi vợ sinh con (BHXH chi 100%)
    const maternityDays = await this.countLeaveDays(
      employeeId,
      year,
      month,
      ['MATERNITY', 'PATERNITY'],
      holidays,
    );

    // ── 4. Tăng ca theo loại ngày ───────────────────────────────────────
    const otByDay = new Map<string, { hours: number; dayType: string }>();

    for (const a of attendances) {
      const hours = a.overtime ?? 0;
      if (hours <= 0) continue;
      const key = dayKey(a.date);
      const dayType = dayTypeFor(a.date, holidays);
      const prev = otByDay.get(key);
      if (!prev || hours > prev.hours) otByDay.set(key, { hours, dayType });
    }

    // Đơn OT duyệt SAU khi chấm công vẫn phải được trả: đối soát theo từng ngày,
    // lấy max để không cộng trùng với giờ đã chấm.
    const otRequests = await this.prisma.leaveRequest.findMany({
      where: {
        employeeId,
        type: 'OT',
        status: 'APPROVED',
        // Đơn OT cũ có thể thiếu overtimeDate → rơi về ngày bắt đầu của đơn
        OR: [
          { overtimeDate: { gte: startDate, lt: endDate } },
          { overtimeDate: null, startDate: { gte: startDate, lt: endDate } },
        ],
      },
      select: { overtimeDate: true, startDate: true, overtimeHours: true },
    });
    for (const req of otRequests) {
      const hours = req.overtimeHours ?? 0;
      if (hours <= 0) continue;
      const date = req.overtimeDate ?? req.startDate;
      const key = dayKey(date);
      const prev = otByDay.get(key);
      if (!prev || hours > prev.hours) {
        otByDay.set(key, { hours, dayType: dayTypeFor(date, holidays) });
      }
    }

    let otNormal = 0;
    let otWeekend = 0;
    let otHoliday = 0;
    for (const entry of otByDay.values()) {
      if (entry.dayType === 'WEEKEND') otWeekend += entry.hours;
      else if (entry.dayType === 'HOLIDAY') otHoliday += entry.hours;
      else otNormal += entry.hours;
    }
    const overtimeHours = Math.round((otNormal + otWeekend + otHoliday) * 100) / 100;

    // ── 5. Thành phần lương ────────────────────────────────────────────
    const baseSalary = contract.baseSalary;
    const allowances = contract.allowances;
    const dailyRate = baseSalary / workingDays;
    const actualBaseSalary = dailyRate * actualWorkingDays;
    const standardHours = config.standardWorkHours > 0 ? config.standardWorkHours : 8;
    const hourlyRate = baseSalary / (workingDays * standardHours);
    const overtimePay =
      hourlyRate *
      (otNormal * config.overtimeRate +
        otWeekend * config.otWeekendRate +
        otHoliday * config.otHolidayRate);

    const bonus = Math.max(0, options.bonus ?? 0);
    const advance = Math.max(0, options.advance ?? 0);

    // ── 6. Bảo hiểm ────────────────────────────────────────────────────
    // Không đóng BHXH/BHYT/BHTN cho tháng mà NLĐ làm việc + nghỉ có lương < 14 ngày
    // (Điều 85 Luật BHXH; áp dụng cho nghỉ thai sản trọn tháng, vào làm giữa tháng…).
    // actualWorkingDays đã gồm ngày phép năm ở bước 2
    const contributionDays = actualWorkingDays;
    const insuranceApplicable = contributionDays >= 14;
    const siCap = insuranceCapFor(period);
    const siBase = insuranceApplicable ? Math.min(baseSalary, siCap) : 0;
    const bhxh = Math.round(siBase * config.bhxhRate);
    const bhyt = Math.round(siBase * config.bhytRate);
    const bhtn = Math.round(siBase * config.bhtnRate);
    const totalInsurance = bhxh + bhyt + bhtn;

    // ── 7. Thuế TNCN ───────────────────────────────────────────────────
    const rule = pitRuleFor(period);
    const personalDeduction =
      config.pitFreeAmount ?? rule.personalDeduction;
    const dependentDeduction =
      config.pitDependentDeduction ?? rule.dependentDeduction;

    const grossIncome = actualBaseSalary + allowances + overtimePay + bonus;
    const taxableIncome =
      grossIncome -
      totalInsurance -
      personalDeduction -
      employee.dependents * dependentDeduction;
    const pit = calculatePit(taxableIncome, rule);

    // ── 8. Trợ cấp BHXH (không nằm trong lương công ty) ────────────────
    const dailyInsuranceBase = baseSalary > 0 ? Math.min(baseSalary, siCap) / workingDays : 0;
    const bhxhBenefit = Math.round(
      dailyInsuranceBase *
        (sickDays * SICK_BENEFIT_RATE + maternityDays * MATERNITY_BENEFIT_RATE),
    );

    const netSalary = Math.round(grossIncome - totalInsurance - pit - advance);

    return {
      employeeId,
      month,
      year,
      baseSalary: Math.round(actualBaseSalary),
      allowances,
      bonus,
      advance,
      overtimeHours,
      overtimePay: Math.round(overtimePay),
      deductions: totalInsurance,
      bhxh,
      bhyt,
      bhtn,
      bhxhBenefit,
      tax: pit,
      netSalary,
      workingDays,
      actualWorkingDays,
      // Meta for transparency (chỉ trả qua HTTP, không lưu DB)
      _breakdown: {
        bhxh,
        bhyt,
        bhtn,
        pit,
        grossIncome: Math.round(grossIncome),
        taxableIncome: Math.round(taxableIncome),
        personalDeduction,
        dependentDeduction,
        dependents: employee.dependents,
        siBase,
        siCap,
        insuranceApplicable,
        paidLeaveDays,
        sickDays,
        maternityDays,
        bhxhBenefit,
        otNormal,
        otWeekend,
        otHoliday,
        pitRuleFrom: rule.from,
      },
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

    // Giữ thưởng/tạm ứng HR đã nhập khi tái tạo bảng lương nháp
    const { _breakdown, ...data } = await this.calculatePayroll(
      employeeId,
      month,
      year,
      { bonus: existing?.bonus ?? 0, advance: existing?.advance ?? 0 },
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
    // Nhân viên thử việc vẫn được trả lương (≥85% lương chính thức) nên phải có
    // trong kỳ lương; chỉ loại người đã nghỉ việc.
    const employees = await this.prisma.employee.findMany({
      where: { status: { in: ['ACTIVE', 'ON_LEAVE', 'PROBATION'] } },
      select: { id: true },
    });

    const results = await Promise.allSettled(
      employees.map((e) => this.generate(e.id, month, year)),
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;
    const errors = results
      .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      .map((r) => (r.reason instanceof Error ? r.reason.message : String(r.reason)));
    return { succeeded, failed, total: employees.length, errors };
  }

  /** Chỉnh thưởng / tạm ứng / ghi chú của bảng lương nháp (tính lại thuế TNCN và thực lĩnh). */
  async adjust(
    id: string,
    dto: { bonus?: number; advance?: number; note?: string },
  ) {
    const payroll = await this.prisma.payroll.findUniqueOrThrow({
      where: { id },
    });
    if (payroll.status !== 'DRAFT') {
      throw new BadRequestException(
        'Chỉ chỉnh được bảng lương đang ở trạng thái nháp (DRAFT)',
      );
    }
    const bonusVal = dto.bonus !== undefined ? Number(dto.bonus) : payroll.bonus;
    const advanceVal = dto.advance !== undefined ? Number(dto.advance) : payroll.advance;
    if (!Number.isFinite(bonusVal) || bonusVal < 0) {
      throw new BadRequestException('Thưởng không hợp lệ (không được âm)');
    }
    if (!Number.isFinite(advanceVal) || advanceVal < 0) {
      throw new BadRequestException('Tạm ứng không hợp lệ (không được âm)');
    }

    const period = vnDateFromParts(payroll.year, payroll.month, 1);
    const [salaryConfig, employee] = await Promise.all([
      this.prisma.salaryConfig.findFirst({
        where: { year: { lte: payroll.year } },
        orderBy: { year: 'desc' },
      }),
      this.prisma.employee.findUnique({
        where: { id: payroll.employeeId },
        select: { dependents: true },
      }),
    ]);
    const config = salaryConfig ?? defaultSalaryConfigFor(period);
    const rule = pitRuleFor(period);
    const personalDeduction = config.pitFreeAmount ?? rule.personalDeduction;
    const dependentDeduction =
      config.pitDependentDeduction ?? rule.dependentDeduction;
    const dependents = employee?.dependents ?? 0;

    const grossIncome =
      payroll.baseSalary + payroll.allowances + payroll.overtimePay + bonusVal;
    const taxableIncome =
      grossIncome -
      payroll.deductions -
      personalDeduction -
      dependents * dependentDeduction;
    const tax = calculatePit(taxableIncome, rule);
    const netSalary = Math.round(
      grossIncome - payroll.deductions - tax - advanceVal,
    );

    return this.prisma.payroll.update({
      where: { id },
      data: {
        bonus: bonusVal,
        advance: advanceVal,
        tax,
        netSalary,
        ...(dto.note !== undefined ? { note: dto.note } : {}),
      },
    });
  }

  /** Duyệt 1 phiếu: chỉ DRAFT → APPROVED */
  async approve(id: string) {
    const payroll = await this.prisma.payroll.findUniqueOrThrow({
      where: { id },
      select: { status: true },
    });
    if (payroll.status !== 'DRAFT') {
      throw new BadRequestException(
        'Chỉ duyệt được bảng lương đang chờ duyệt (DRAFT)',
      );
    }
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

  /** Chi trả 1 phiếu: chỉ APPROVED → PAID */
  async markAsPaid(id: string) {
    const payroll = await this.prisma.payroll.findUniqueOrThrow({
      where: { id },
      select: { status: true },
    });
    if (payroll.status !== 'APPROVED') {
      throw new BadRequestException(
        'Chỉ chi trả được bảng lương đã duyệt (APPROVED)',
      );
    }
    return this.prisma.payroll.update({
      where: { id },
      data: { status: 'PAID', paidAt: new Date() },
    });
  }

  /**
   * Số ngày nghỉ (thuộc `types`, đã duyệt) rơi vào tháng — chỉ đếm ngày làm việc,
   * trừ cuối tuần và ngày lễ. Dùng ngày thực tế của đơn, không tin `totalDays`
   * (dữ liệu cũ từng lưu 0 ngày do bug tính ngày).
   */
  private async countLeaveDays(
    employeeId: string,
    year: number,
    month: number,
    types: ('ANNUAL' | 'BUSINESS_TRIP' | 'SICK' | 'MATERNITY' | 'PATERNITY')[],
    holidays: ReadonlySet<string>,
    excludeDays?: ReadonlySet<string>,
  ) {
    const { gte, lt } = vnMonthRange(year, month);
    const leaves = await this.prisma.leaveRequest.findMany({
      where: {
        employeeId,
        type: { in: types },
        status: 'APPROVED',
        startDate: { lt },
        endDate: { gte },
      },
      select: { startDate: true, endDate: true },
    });

    if (!excludeDays || excludeDays.size === 0) {
      return leaves.reduce((sum, r) => {
        const from = r.startDate > gte ? r.startDate : gte;
        // Lùi đúng 1 NGÀY (không phải 1ms): lt là 00:00 UTC ngày 1 tháng sau, trừ 1ms
        // sẽ thành 23:59 UTC ngày cuối tháng = 06:59 sáng hôm sau theo giờ VN → đếm thừa 1 ngày.
        const to =
          r.endDate < lt ? r.endDate : new Date(lt.getTime() - DAY_MS);
        return sum + countWorkdays(from, to, holidays);
      }, 0);
    }

    const counted = new Set<string>();
    for (const r of leaves) {
      const from = r.startDate > gte ? r.startDate : gte;
      const to = r.endDate < lt ? r.endDate : new Date(lt.getTime() - DAY_MS);
      for (const d of eachDay(from, to)) {
        if (dayTypeFor(d, holidays) !== 'NORMAL') continue;
        const key = dayKey(d);
        if (excludeDays.has(key)) continue;
        counted.add(key);
      }
    }
    return counted.size;
  }
}
