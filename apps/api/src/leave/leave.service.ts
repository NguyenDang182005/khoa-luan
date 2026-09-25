import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ensureDefaultLeavePolicy } from '../settings/single-row.utils';
import {
  computeBalance,
  countWorkdays,
  LeavePolicyConfig,
} from './leave-entitlement';

@Injectable()
export class LeaveService {
  constructor(private prisma: PrismaService) {}

  findAll(params: { status?: string; employeeId?: string }) {
    return this.prisma.leaveRequest.findMany({
      where: {
        ...(params.status ? { status: params.status as any } : {}),
        ...(params.employeeId ? { employeeId: params.employeeId } : {}),
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

  findOne(id: string) {
    return this.prisma.leaveRequest.findUniqueOrThrow({
      where: { id },
      include: {
        employee: true,
        approvedBy: { select: { id: true, fullName: true } },
      },
    });
  }

  async create(dto: {
    employeeId: string;
    type: string;
    startDate: Date;
    endDate: Date;
    reason: string;
  }) {
    const totalDays = this.calculateDays(
      new Date(dto.startDate),
      new Date(dto.endDate),
    );

    // Check balance
    const balance = await this.getBalance(
      dto.employeeId,
      new Date(dto.startDate).getFullYear(),
    );
    if (dto.type === 'ANNUAL' && balance.remaining < totalDays) {
      throw new BadRequestException(
        `Số ngày phép không đủ. Còn lại: ${balance.remaining} ngày`,
      );
    }

    return this.prisma.leaveRequest.create({
      data: {
        employeeId: dto.employeeId,
        type: dto.type as any,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        totalDays,
        reason: dto.reason,
        status: 'PENDING',
      },
    });
  }

  async approve(id: string, approverId: string) {
    const request = await this.prisma.leaveRequest.findUniqueOrThrow({
      where: { id },
    });
    if (request.status !== 'PENDING') {
      throw new BadRequestException('Chỉ có thể duyệt đơn đang chờ xét duyệt');
    }

    // Update attendance records as ON_LEAVE
    const dates = this.getDatesBetween(request.startDate, request.endDate);
    await Promise.all(
      dates.map((date) =>
        this.prisma.attendance.upsert({
          where: { employeeId_date: { employeeId: request.employeeId, date } },
          create: { employeeId: request.employeeId, date, status: 'ON_LEAVE' },
          update: { status: 'ON_LEAVE' },
        }),
      ),
    );

    return this.prisma.leaveRequest.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedById: approverId,
        approvedAt: new Date(),
      },
    });
  }

  async reject(id: string, approverId: string, rejectionReason: string) {
    const request = await this.prisma.leaveRequest.findUniqueOrThrow({
      where: { id },
    });
    if (request.status !== 'PENDING') {
      throw new BadRequestException('Chỉ có thể từ chối đơn đang chờ xét duyệt');
    }

    return this.prisma.leaveRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        approvedById: approverId,
        approvedAt: new Date(),
        rejectionReason,
      },
    });
  }

  async cancel(id: string, employeeId: string) {
    const request = await this.prisma.leaveRequest.findUniqueOrThrow({
      where: { id },
    });
    if (request.employeeId !== employeeId) {
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

  /**
   * Số dư phép năm — đọc chính sách từ bảng LeavePolicy (trang Cài Đặt > Phép Năm).
   * Bao gồm: quota chuẩn + thâm niên + pro-rate năm đầu + carry-over từ năm trước.
   * Ngày dùng được tính theo ngày CHỒNG LẤN với năm xét (sửa lỗi cũ: đơn vắt qua
   * 2 năm trước đây bị loại toàn bộ khỏi tích).
   */
  async getBalance(employeeId: string, year: number) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: { joinDate: true },
    });
    if (!employee) throw new NotFoundException('Không tìm thấy nhân viên');

    const policyRow = await ensureDefaultLeavePolicy(this.prisma);
    const policy: LeavePolicyConfig = {
      annualQuotaDays: policyRow.annualQuotaDays,
      seniorityBonusEveryYears: policyRow.seniorityBonusEveryYears,
      seniorityBonusDays: policyRow.seniorityBonusDays,
      prorateByJoinMonth: policyRow.prorateByJoinMonth,
      maxCarryOverDays: policyRow.maxCarryOverDays,
    };

    // Lấy các đơn ANNUAL đã duyệt có khả năng chồng lấn năm xét hoặc năm liền trước
    const approved = await this.prisma.leaveRequest.findMany({
      where: {
        employeeId,
        type: 'ANNUAL',
        status: 'APPROVED',
        startDate: { lte: new Date(year, 11, 31) },
        endDate: { gte: new Date(year - 1, 0, 1) },
      },
    });

    const usedInYear = (y: number) => {
      const jan1 = new Date(y, 0, 1);
      const dec31 = new Date(y, 11, 31);
      return approved.reduce((sum, r) => {
        const from = r.startDate > jan1 ? r.startDate : jan1;
        const to = r.endDate < dec31 ? r.endDate : dec31;
        return sum + countWorkdays(from, to);
      }, 0);
    };

    const balance = computeBalance({
      policy,
      joinDate: employee.joinDate,
      year,
      usedThisYear: usedInYear(year),
      usedPrevYear: usedInYear(year - 1),
    });
    return balance;
  }

  private calculateDays(start: Date, end: Date): number {
    let count = 0;
    const curr = new Date(start);
    while (curr <= end) {
      const day = curr.getDay();
      if (day !== 0 && day !== 6) count++;
      curr.setDate(curr.getDate() + 1);
    }
    return count;
  }

  private getDatesBetween(start: Date, end: Date): Date[] {
    const dates: Date[] = [];
    const curr = new Date(start);
    while (curr <= end) {
      const d = new Date(curr);
      d.setHours(0, 0, 0, 0);
      dates.push(d);
      curr.setDate(curr.getDate() + 1);
    }
    return dates;
  }
}
