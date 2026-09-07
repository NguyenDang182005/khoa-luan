import {
  Injectable,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AttendanceService {
  constructor(private prisma: PrismaService) {}

  findByEmployee(employeeId: string, month: number, year: number) {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0);
    return this.prisma.attendance.findMany({
      where: { employeeId, date: { gte: start, lte: end } },
      orderBy: { date: 'asc' },
    });
  }

  findAll(month: number, year: number) {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0);
    return this.prisma.attendance.findMany({
      where: { date: { gte: start, lte: end } },
      include: {
        employee: {
          select: {
            id: true,
            fullName: true,
            employeeCode: true,
            department: { select: { name: true } },
          },
        },
      },
      orderBy: [{ date: 'desc' }, { employee: { fullName: 'asc' } }],
    });
  }

  async checkIn(employeeId: string, location?: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existing = await this.prisma.attendance.findUnique({
      where: { employeeId_date: { employeeId, date: today } },
    });

    if (existing?.checkIn) {
      throw new ConflictException('Đã check-in hôm nay rồi');
    }

    const now = new Date();
    // Late if after 8:30
    const lateThreshold = new Date();
    lateThreshold.setHours(8, 30, 0, 0);
    const status = now > lateThreshold ? 'LATE' : 'PRESENT';

    if (existing) {
      return this.prisma.attendance.update({
        where: { id: existing.id },
        data: { checkIn: now, status, location },
      });
    }

    return this.prisma.attendance.create({
      data: {
        employeeId,
        date: today,
        checkIn: now,
        status,
        location,
      },
    });
  }

  async checkOut(employeeId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const attendance = await this.prisma.attendance.findUnique({
      where: { employeeId_date: { employeeId, date: today } },
    });

    if (!attendance) {
      throw new BadRequestException('Chưa check-in hôm nay');
    }
    if (attendance.checkOut) {
      throw new ConflictException('Đã check-out hôm nay rồi');
    }
    if (!attendance.checkIn) {
      throw new BadRequestException('Không tìm thấy thời gian check-in');
    }

    const now = new Date();
    const checkIn = attendance.checkIn;
    const diffMs = now.getTime() - checkIn.getTime();
    const workHours = Math.round((diffMs / 3_600_000) * 100) / 100;
    const overtime = Math.max(0, Math.round((workHours - 8) * 100) / 100);

    return this.prisma.attendance.update({
      where: { id: attendance.id },
      data: { checkOut: now, workHours, overtime },
    });
  }

  async getMonthlyReport(employeeId: string, month: number, year: number) {
    const attendances = await this.findByEmployee(employeeId, month, year);

    const totalWorkHours = attendances.reduce(
      (sum, a) => sum + (a.workHours ?? 0),
      0,
    );
    const totalOvertime = attendances.reduce(
      (sum, a) => sum + (a.overtime ?? 0),
      0,
    );

    const byStatus = attendances.reduce(
      (acc, a) => {
        acc[a.status] = (acc[a.status] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      employeeId,
      month,
      year,
      summary: {
        totalDays: attendances.length,
        presentDays: (byStatus['PRESENT'] ?? 0) + (byStatus['REMOTE'] ?? 0),
        lateDays: byStatus['LATE'] ?? 0,
        absentDays: byStatus['ABSENT'] ?? 0,
        onLeaveDays: byStatus['ON_LEAVE'] ?? 0,
        halfDays: byStatus['HALF_DAY'] ?? 0,
        totalWorkHours: Math.round(totalWorkHours * 100) / 100,
        totalOvertime: Math.round(totalOvertime * 100) / 100,
      },
      records: attendances,
    };
  }

  async upsertRecord(
    employeeId: string,
    date: Date,
    data: {
      status?: string;
      checkIn?: Date;
      checkOut?: Date;
      note?: string;
      location?: string;
    },
  ) {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);

    return this.prisma.attendance.upsert({
      where: { employeeId_date: { employeeId, date: dayStart } },
      create: { employeeId, date: dayStart, ...data } as any,
      update: data as any,
    });
  }
}
