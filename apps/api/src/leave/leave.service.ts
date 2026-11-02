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
      const overlapping = await this.prisma.leaveRequest.findFirst({
        where: {
          employeeId: dto.employeeId,
          type: { not: 'OT' },
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

    if (dto.type === 'ANNUAL') {
      const balance = await this.getBalance(
        dto.employeeId,
        start.getFullYear(),
      );
      if (balance.remaining < totalDays) {
        throw new BadRequestException(
          `Số ngày phép không đủ. Còn lại: ${balance.remaining} ngày, đơn cần ${totalDays} ngày`,
        );
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
        overtimeDate: dto.overtimeDate ? vnDateUtc(new Date(dto.overtimeDate)) : null,
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

    const year = request.startDate.getFullYear();
    const yearStart = vnDateFromParts(year, 1, 1);
    const yearEndExclusive = vnDateFromParts(year + 1, 1, 1);
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

    return this.prisma.$transaction(async (tx) => {
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
        const used = approved.reduce((sum, r) => {
          const start = r.startDate > yearStart ? r.startDate : yearStart;
          const end =
            r.endDate < yearEndExclusive
              ? r.endDate
              : new Date(yearEndExclusive.getTime() - DAY_MS);
          return sum + countWorkdays(start, end, holidays);
        }, 0);
        const balance = computeBalance({
          policy: policyConfig,
          joinDate: request.employee.joinDate,
          year,
          usedThisYear: used,
          usedPrevYear: 0,
        });
        if (balance.remaining < requestedDays) {
          throw new BadRequestException(
            `Không đủ phép để duyệt. Còn lại ${balance.remaining} ngày, đơn yêu cầu ${requestedDays} ngày.`,
          );
        }
      }

      // Chấm công ON_LEAVE cho các NGÀY LÀM VIỆC của đơn (bỏ cuối tuần + ngày lễ)
      if (request.type !== 'OT') {
        const workDates = eachDay(request.startDate, request.endDate).filter(
          (date) => dayTypeFor(date, holidays) === 'NORMAL',
        );
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

  async cancel(id: string, employeeUserId: string) {
    const request = await this.prisma.leaveRequest.findUniqueOrThrow({
      where: { id },
    });
    const employee = await this.prisma.employee.findUnique({
      where: { userId: employeeUserId },
      select: { id: true },
    });
    if (request.employeeId !== employee?.id) {
      throw new BadRequestException('Không có quyền hủy đơn này');
    }
    if (!['PENDING'].includes(request.status)) {
      throw new BadRequestException('Chỉ có thể hủy đơn đang chờ xét duyệt');
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
