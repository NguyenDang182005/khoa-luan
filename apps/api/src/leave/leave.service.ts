import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ensureDefaultLeavePolicy } from '../settings/single-row.utils';
import {
  computeBalance,
  countWorkdays,
  LeavePolicyConfig,
} from './leave-entitlement';
import { vnDateFromParts, vnDateUtc } from '../common/vn-date';
import { eachDay, dayTypeFor } from '../common/workdays';
import { loadHolidays } from '../common/holidays';

const LEAVE_TYPES = [
  'ANNUAL',
  'SICK',
  'MATERNITY',
  'PATERNITY',
  'UNPAID',
  'EMERGENCY',
  'OT',
  'LATE_PERMISSION',
  'BUSINESS_TRIP',
  'OTHER',
] as const;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Đơn nghỉ phép / tăng ca.
 *
 * Quy ước số ngày (sát thực tế):
 * - Đơn theo ngày: đếm ngày làm việc T2–T6, TRỪ ngày lễ quốc gia. Vì vậy đơn vắt qua
 *   lễ/T7/CN không bị trừ phép cho những ngày đó.
 * - Đơn OT: `totalDays` chỉ để hiển thị (giờ/8), tiền OT tính theo `overtimeHours`.
 */
@Injectable()
export class LeaveService {
  constructor(private prisma: PrismaService) {}

  findAll(params: {
    status?: string;
    employeeId?: string;
    ownUserId?: string | null;
  }) {
    return this.prisma.leaveRequest.findMany({
      where: {
        ...(params.status ? { status: params.status as any } : {}),
        ...(params.employeeId ? { employeeId: params.employeeId } : {}),
        ...(params.ownUserId ? { employee: { userId: params.ownUserId } } : {}),
      },
      include: {
        employee: {
          select: {
            id: true,
            fullName: true,
            employeeCode: true,
            department: { select: { name: true } },
          },
        },
        approvedBy: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Chi tiết đơn — nhân viên chỉ xem được đơn của chính mình. */
  async findOne(id: string, viewerUserId?: string | null) {
    const request = await this.prisma.leaveRequest.findUniqueOrThrow({
      where: { id },
      include: {
        employee: true,
        approvedBy: { select: { id: true, fullName: true } },
      },
    });
    if (viewerUserId && request.employee.userId !== viewerUserId) {
      throw new ForbiddenException('Chỉ xem được đơn nghỉ của chính mình');
    }
    return request;
  }

  async create(dto: {
    employeeId: string;
    type: string;
    startDate: Date;
    endDate: Date;
    reason: string;
    overtimeHours?: number;
    overtimeDate?: Date;
  }, ownUserId?: string | null) {
    // Nhân viên chỉ tạo đơn cho chính mình — bỏ qua employeeId client gửi lên.
    if (ownUserId) {
      const own = await this.prisma.employee.findUnique({
        where: { userId: ownUserId },
        select: { id: true },
      });
      if (!own) throw new NotFoundException('Tài khoản không liên kết hồ sơ nhân viên');
      dto = { ...dto, employeeId: own.id };
    }
    if (!LEAVE_TYPES.includes(dto.type as (typeof LEAVE_TYPES)[number])) {
      throw new BadRequestException(
        `Loại đơn không hợp lệ — cho phép: ${LEAVE_TYPES.join(', ')}`,
      );
    }

    const start = vnDateUtc(new Date(dto.startDate));
    const end = vnDateUtc(new Date(dto.endDate));
    if (end < start) {
      throw new BadRequestException('Ngày kết thúc phải sau ngày bắt đầu');
    }

    let totalDays: number;
    if (dto.type === 'OT') {
      const hours = dto.overtimeHours ?? 0;
      if (!(hours > 0) || hours > 24) {
        throw new BadRequestException('Đơn tăng ca phải có số giờ > 0');
      }
      totalDays = Math.round((hours / 8) * 100) / 100;
    } else {
      const holidays = await loadHolidays(
        this.prisma,
        start,
        new Date(end.getTime() + DAY_MS),
      );
      totalDays = countWorkdays(start, end, holidays);
      if (totalDays <= 0) {
        throw new BadRequestException(
          'Khoảng ngày đã chọn không có ngày làm việc (chỉ rơi vào cuối tuần/ngày lễ)',
        );
      }

      // Không cho trùng đơn đang chờ/đã duyệt trên cùng khoảng ngày
      // (LATE_PERMISSION chỉ là xin đến muộn, không phải nghỉ nguyên ngày nên không chặn đơn nghỉ)
      if (dto.type !== 'LATE_PERMISSION') {
        const overlapping = await this.prisma.leaveRequest.findFirst({
          where: {
            employeeId: dto.employeeId,
            type: { notIn: ['OT', 'LATE_PERMISSION'] },
            status: { in: ['PENDING', 'APPROVED'] },
            startDate: { lte: end },
            endDate: { gte: start },
          },
          select: { id: true, type: true, startDate: true, endDate: true },
        });
        if (overlapping) {
          throw new BadRequestException(
            'Khoảng ngày này đã có đơn nghỉ khác đang chờ/đã duyệt',
          );
        }
      }
    }

    if (dto.type === 'ANNUAL') {
      const startYear = start.getUTCFullYear();
      const endYear = end.getUTCFullYear();
      const holidays = await loadHolidays(
        this.prisma,
        vnDateFromParts(startYear, 1, 1),
        vnDateFromParts(endYear + 1, 1, 1),
      );
      for (let y = startYear; y <= endYear; y++) {
        const yStart = vnDateFromParts(y, 1, 1);
        const yEnd = new Date(vnDateFromParts(y + 1, 1, 1).getTime() - DAY_MS);
        const segStart = start > yStart ? start : yStart;
        const segEnd = end < yEnd ? end : yEnd;
        const daysInYear = countWorkdays(segStart, segEnd, holidays);
        if (daysInYear <= 0) continue;
        const balance = await this.getBalance(dto.employeeId, y);
        if (balance.remaining < daysInYear) {
          throw new BadRequestException(
            `Số ngày phép năm ${y} không đủ. Còn lại: ${balance.remaining} ngày, đơn cần ${daysInYear} ngày`,
          );
        }
      }
    }

    return this.prisma.leaveRequest.create({
      data: {
        employeeId: dto.employeeId,
        type: dto.type as any,
        startDate: start,
        endDate: end,
        totalDays,
        overtimeHours: dto.overtimeHours ?? null,
        // OT luôn có ngày làm thêm (mặc định = ngày bắt đầu): bảng lương lọc OT theo overtimeDate
        overtimeDate:
          dto.type === 'OT'
            ? dto.overtimeDate
              ? vnDateUtc(new Date(dto.overtimeDate))
              : start
            : null,
        reason: dto.reason,
        status: 'PENDING',
      },
    });
  }

  async approve(id: string, approverUserId: string) {
    const request = await this.prisma.leaveRequest.findUniqueOrThrow({
      where: { id },
      include: { employee: { select: { joinDate: true } } },
    });
    if (request.status !== 'PENDING') {
      throw new BadRequestException('Chỉ có thể duyệt đơn đang chờ xét duyệt');
    }

    const approver = await this.prisma.employee.findUnique({
      where: { userId: approverUserId },
      select: { id: true },
    });
    if (!approver) {
      throw new ForbiddenException('Chỉ HR/ADMIN mới có quyền duyệt đơn');
    }

    const startYear = request.startDate.getUTCFullYear();
    const endYear = request.endDate.getUTCFullYear();
    const yearStart = vnDateFromParts(startYear, 1, 1);
    const yearEndExclusive = vnDateFromParts(endYear + 1, 1, 1);
    const from = new Date(
      Math.min(yearStart.getTime(), request.startDate.getTime()),
    );
    const toExclusive = new Date(
      Math.max(yearEndExclusive.getTime(), request.endDate.getTime() + DAY_MS),
    );
    const holidays = await loadHolidays(this.prisma, from, toExclusive);

    // Tính lại số ngày từ ngày thực tế (dữ liệu cũ có thể lưu 0 do bug cũ)
    const requestedDays =
      request.type === 'OT'
        ? request.totalDays
        : countWorkdays(request.startDate, request.endDate, holidays);
    if (requestedDays <= 0) {
      throw new BadRequestException(
        'Đơn không còn ngày làm việc nào (toàn cuối tuần/ngày lễ)',
      );
    }

    // Ngày làm việc (T2–T6, không lễ) mà đơn chiếm — dùng cho ghi chấm công
    const workDates = eachDay(request.startDate, request.endDate).filter(
      (date) => dayTypeFor(date, holidays) === 'NORMAL',
    );

    // Kỳ lương đã duyệt/trả thì không tính lại được → duyệt đơn vào kỳ đó sẽ lệch lương
    await this.assertPayrollOpen(request);

    return this.prisma.$transaction(async (tx) => {
      // Khóa theo nhân viên: các lượt duyệt song song (duyệt hàng loạt) của cùng một người
      // chạy lần lượt, nên lần sau thấy số ngày phép lần trước vừa trừ.
      await tx.$queryRaw`SELECT id FROM employees WHERE id = ${request.employeeId} FOR UPDATE`;
      const fresh = await tx.leaveRequest.findUnique({
        where: { id },
        select: { status: true },
      });
      if (fresh?.status !== 'PENDING') {
        throw new BadRequestException('Chỉ có thể duyệt đơn đang chờ xét duyệt');
      }

      if (request.type !== 'OT' && request.type !== 'LATE_PERMISSION') {
        const overlappingApproved = await tx.leaveRequest.findFirst({
          where: {
            employeeId: request.employeeId,
            id: { not: request.id },
            type: { notIn: ['OT', 'LATE_PERMISSION'] },
            status: 'APPROVED',
            startDate: { lte: request.endDate },
            endDate: { gte: request.startDate },
          },
          select: { id: true },
        });
        if (overlappingApproved) {
          throw new BadRequestException(
            'Khoảng ngày này đã có đơn nghỉ khác được duyệt',
          );
        }
      }

      if (request.type === 'ANNUAL') {
        const policy = await ensureDefaultLeavePolicy(tx as any);
        const policyConfig: LeavePolicyConfig = {
          annualQuotaDays: policy.annualQuotaDays,
          seniorityBonusEveryYears: policy.seniorityBonusEveryYears,
          seniorityBonusDays: policy.seniorityBonusDays,
          prorateByJoinMonth: policy.prorateByJoinMonth,
          maxCarryOverDays: policy.maxCarryOverDays,
        };
        const approved = await tx.leaveRequest.findMany({
          where: {
            employeeId: request.employeeId,
            type: 'ANNUAL',
            status: 'APPROVED',
            id: { not: request.id },
            startDate: { lt: yearEndExclusive },
            endDate: { gte: yearStart },
          },
        });
        for (let y = startYear; y <= endYear; y++) {
          const yStart = vnDateFromParts(y, 1, 1);
          const yEndExclusive = vnDateFromParts(y + 1, 1, 1);
          const yEnd = new Date(yEndExclusive.getTime() - DAY_MS);
          const segStart = request.startDate > yStart ? request.startDate : yStart;
          const segEnd = request.endDate < yEnd ? request.endDate : yEnd;
          const neededInYear = countWorkdays(segStart, segEnd, holidays);
          if (neededInYear <= 0) continue;

          const used = approved.reduce((sum, r) => {
            const start = r.startDate > yStart ? r.startDate : yStart;
            const end = r.endDate < yEndExclusive ? r.endDate : yEnd;
            return sum + countWorkdays(start, end, holidays);
          }, 0);
          const balance = computeBalance({
            policy: policyConfig,
            joinDate: request.employee.joinDate,
            year: y,
            usedThisYear: used,
            usedPrevYear: 0,
          });
          if (balance.remaining < neededInYear) {
            throw new BadRequestException(
              `Không đủ phép năm ${y} để duyệt. Còn lại ${balance.remaining} ngày, đơn yêu cầu ${neededInYear} ngày.`,
            );
          }
        }
      }

      if (request.type === 'LATE_PERMISSION') {
        // Đến muộn / về sớm có phép: chỉ xóa dấu đi muộn, giữ nguyên giờ làm và số công.
        // Ngày chưa chấm công thì lúc check-in sẽ tự ra PRESENT (xem AttendanceService).
        await tx.attendance.updateMany({
          where: {
            employeeId: request.employeeId,
            date: { in: workDates.map((d) => vnDateUtc(d)) },
            status: 'LATE',
          },
          data: { status: 'PRESENT' },
        });
      } else if (request.type !== 'OT') {
        // Không ghi đè ngày đã đi làm: mất giờ làm thật, còn phép năm/công tác
        // sẽ bị cộng trùng với công chấm được.
        const worked = await tx.attendance.findMany({
          where: {
            employeeId: request.employeeId,
            date: { in: workDates.map((d) => vnDateUtc(d)) },
            checkIn: { not: null },
          },
          select: { date: true },
          orderBy: { date: 'asc' },
        });
        if (worked.length > 0) {
          const days = worked
            .map((w) => w.date.toISOString().slice(0, 10).split('-').reverse().join('/'))
            .join(', ');
          throw new BadRequestException(
            `Nhân viên đã chấm công vào ngày ${days} — sửa khoảng ngày của đơn hoặc từ chối đơn`,
          );
        }

        // Chấm công ON_LEAVE cho các NGÀY LÀM VIỆC của đơn (bỏ cuối tuần + ngày lễ)
        await Promise.all(
          workDates.map((date) =>
            tx.attendance.upsert({
              where: {
                employeeId_date: {
                  employeeId: request.employeeId,
                  date: vnDateUtc(date),
                },
              },
              create: {
                employeeId: request.employeeId,
                date: vnDateUtc(date),
                status: 'ON_LEAVE',
                workDays: 0,
              },
              update: { status: 'ON_LEAVE', workDays: 0 },
            }),
          ),
        );
      }

      return tx.leaveRequest.update({
        where: { id },
        data: {
          status: 'APPROVED',
          totalDays: requestedDays,
          approvedById: approver.id,
          approvedAt: new Date(),
        },
      });
    });
  }

  /** Chặn duyệt đơn rơi vào kỳ lương đã APPROVED/PAID (không tính lại được nữa). */
  private async assertPayrollOpen(request: {
    employeeId: string;
    type: string;
    startDate: Date;
    endDate: Date;
    overtimeDate: Date | null;
  }) {
    // Ngày lưu dạng 00:00 UTC của ngày theo giờ VN → đọc tháng/năm theo UTC
    const dates =
      request.type === 'OT'
        ? [request.overtimeDate ?? request.startDate]
        : [request.startDate, request.endDate];
    const periods = new Map<string, { month: number; year: number }>();
    const first = dates[0]!;
    const last = dates[dates.length - 1]!;
    for (
      let y = first.getUTCFullYear(), m = first.getUTCMonth() + 1;
      y < last.getUTCFullYear() || (y === last.getUTCFullYear() && m <= last.getUTCMonth() + 1);
      m === 12 ? ((m = 1), y++) : m++
    ) {
      periods.set(`${y}-${m}`, { month: m, year: y });
    }

    const locked = await this.prisma.payroll.findMany({
      where: {
        employeeId: request.employeeId,
        status: { in: ['APPROVED', 'PAID'] },
        OR: [...periods.values()],
      },
      select: { month: true, year: true, status: true },
    });
    if (locked.length > 0) {
      const list = locked.map((p) => `${p.month}/${p.year}`).join(', ');
      throw new BadRequestException(
        `Kỳ lương tháng ${list} đã chốt (duyệt/đã trả) — đơn duyệt lúc này sẽ không được tính vào lương`,
      );
    }
  }

  async reject(id: string, approverUserId: string, rejectionReason: string) {
    const request = await this.prisma.leaveRequest.findUniqueOrThrow({
      where: { id },
    });
    if (request.status !== 'PENDING') {
      throw new BadRequestException('Chỉ có thể từ chối đơn đang chờ xét duyệt');
    }

    const approver = await this.prisma.employee.findUnique({
      where: { userId: approverUserId },
      select: { id: true },
    });
    if (!approver) {
      throw new ForbiddenException('Chỉ HR/ADMIN mới có quyền từ chối đơn');
    }

    return this.prisma.leaveRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        approvedById: approver.id,
        approvedAt: new Date(),
        rejectionReason,
      },
    });
  }

  async cancel(id: string, callerUserId: string, isAdmin = false) {
    const request = await this.prisma.leaveRequest.findUniqueOrThrow({
      where: { id },
    });
    if (!isAdmin) {
      const employee = await this.prisma.employee.findUnique({
        where: { userId: callerUserId },
        select: { id: true },
      });
      if (request.employeeId !== employee?.id) {
        throw new ForbiddenException('Không có quyền hủy đơn này');
      }
      if (request.status !== 'PENDING') {
        throw new BadRequestException('Chỉ có thể hủy đơn đang chờ xét duyệt');
      }
      return this.prisma.leaveRequest.update({
        where: { id },
        data: { status: 'CANCELLED' },
      });
    }

    // ADMIN được phép hủy cả đơn PENDING lẫn APPROVED (khi nhân viên thay đổi kế hoạch và vẫn đi làm).
    if (!['PENDING', 'APPROVED'].includes(request.status)) {
      throw new BadRequestException('Chỉ có thể hủy đơn đang chờ hoặc đã duyệt');
    }

    if (request.status === 'APPROVED') {
      await this.assertPayrollOpen(request);
      return this.prisma.$transaction(async (tx) => {
        if (request.type !== 'OT' && request.type !== 'LATE_PERMISSION') {
          // Xóa các dòng chấm công ON_LEAVE chưa check-in do đơn này sinh ra
          await tx.attendance.deleteMany({
            where: {
              employeeId: request.employeeId,
              date: { gte: request.startDate, lte: request.endDate },
              status: 'ON_LEAVE',
              checkIn: null,
            },
          });
        }
        return tx.leaveRequest.update({
          where: { id },
          data: { status: 'CANCELLED' },
        });
      });
    }

    return this.prisma.leaveRequest.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
  }

  /** Số dư phép năm. `viewerUserId` (nếu có) phải là chủ hồ sơ — tránh xem chéo. */
  async getBalance(employeeId: string, year: number, viewerUserId?: string | null) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: { joinDate: true, userId: true },
    });
    if (!employee) throw new NotFoundException('Không tìm thấy nhân viên');
    if (viewerUserId && employee.userId !== viewerUserId) {
      throw new ForbiddenException('Chỉ xem được số phép của chính mình');
    }

    const policyRow = await ensureDefaultLeavePolicy(this.prisma);
    const policy: LeavePolicyConfig = {
      annualQuotaDays: policyRow.annualQuotaDays,
      seniorityBonusEveryYears: policyRow.seniorityBonusEveryYears,
      seniorityBonusDays: policyRow.seniorityBonusDays,
      prorateByJoinMonth: policyRow.prorateByJoinMonth,
      maxCarryOverDays: policyRow.maxCarryOverDays,
    };

    const rangeStart = vnDateFromParts(year - 1, 1, 1);
    const rangeEnd = vnDateFromParts(year + 1, 1, 1);
    const holidays = await loadHolidays(this.prisma, rangeStart, rangeEnd);

    const approved = await this.prisma.leaveRequest.findMany({
      where: {
        employeeId,
        type: 'ANNUAL',
        status: 'APPROVED',
        startDate: { lt: rangeEnd },
        endDate: { gte: rangeStart },
      },
    });

    const usedInYear = (y: number) => {
      const start = vnDateFromParts(y, 1, 1);
      const endExclusive = vnDateFromParts(y + 1, 1, 1);
      return approved.reduce((sum, r) => {
        const from = r.startDate > start ? r.startDate : start;
        const to =
          r.endDate < endExclusive
            ? r.endDate
            : new Date(endExclusive.getTime() - DAY_MS);
        return sum + countWorkdays(from, to, holidays);
      }, 0);
    };

    return computeBalance({
      policy,
      joinDate: employee.joinDate,
      year,
      usedThisYear: usedInYear(year),
      usedPrevYear: usedInYear(year - 1),
    });
  }
}
