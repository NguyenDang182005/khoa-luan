import {
  Injectable,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { vnDateUtc, vnMonthRange, vnMinutesOfDay } from '../common/vn-date';
import { dayTypeFor } from '../common/workdays';
import { loadHolidays } from '../common/holidays';
import { ensureDefaultGeofence } from '../settings/single-row.utils';

const DAY_MS = 24 * 60 * 60 * 1000;
const WORK_START_HOUR = 8;
const WORK_START_MIN = 0;
const WORK_END_HOUR = 17;
const WORK_END_MIN = 0;
const WORK_DAILY_MINUTES = 8 * 60; // 8–12 & 13–17
const LATE_CUTOFF_MINUTES = WORK_START_HOUR * 60 + 30; // 8:30

/** Khoảng cách Haversine giữa 2 tọa độ (mét) */
export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function roundQuarter(n: number): number {
  return Math.ceil(n * 4) / 4;
}

function minutesBetween(a: Date, b: Date): number {
  return Math.max(0, (b.getTime() - a.getTime()) / 1000 / 60);
}

/** Tổng phút ngày `d` nằm trong cửa sổ làm việc (8–12 & 13–17) theo giờ VN. */
function workMinutesOn(date: Date, checkIn?: Date, checkOut?: Date): number {
  const start = checkIn ?? date;
  const end = checkOut ?? date;
  if (end <= start) return 0;
  const vnDate = date;
  const morningStart = new Date(vnDate);
  morningStart.setHours(8, 0, 0, 0);
  const morningEnd = new Date(vnDate);
  morningEnd.setHours(12, 0, 0, 0);
  const afternoonStart = new Date(vnDate);
  afternoonStart.setHours(13, 0, 0, 0);
  const afternoonEnd = new Date(vnDate);
  afternoonEnd.setHours(17, 0, 0, 0);
  let total = 0;
  total += minutesBetween(
    start > morningStart ? start : morningStart,
    end < morningEnd ? end : morningEnd,
  );
  total += minutesBetween(
    start > afternoonStart ? start : afternoonStart,
    end < afternoonEnd ? end : afternoonEnd,
  );
  return total;
}

@Injectable()
export class AttendanceService {
  constructor(private prisma: PrismaService) {}

  private async employeeIdFromUser(userId: string): Promise<string> {
    const employee = await this.prisma.employee.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!employee) {
      throw new NotFoundException('Tài khoản không liên kết hồ sơ nhân viên');
    }
    return employee.id;
  }

  private async assertCanView(employeeId: string, userId: string) {
    const viewer = await this.prisma.employee.findUnique({
      where: { userId },
      select: { id: true, user: { select: { role: true } } },
    });
    if (viewer?.user.role === 'ADMIN') return;
    if (viewer?.id !== employeeId) {
      throw new ForbiddenException('Chỉ xem được chấm công của chính mình');
    }
  }

  async findByEmployeeForViewer(
    employeeId: string,
    month: number,
    year: number,
    viewerUserId: string,
  ) {
    await this.assertCanView(employeeId, viewerUserId);
    return this.findByEmployee(employeeId, month, year);
  }

  findByEmployee(employeeId: string, month: number, year: number) {
    const { gte, lt } = vnMonthRange(year, month);
    return this.prisma.attendance.findMany({
      where: { employeeId, date: { gte, lt } },
      orderBy: { date: 'asc' },
    });
  }

  findAll(month: number, year: number) {
    const { gte, lt } = vnMonthRange(year, month);
    return this.prisma.attendance.findMany({
      where: { date: { gte, lt } },
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

  /** Check-in chỉ hợp lệ trong bán kính văn phòng — kiểm tra ở server, không tin client. */
  private async assertInsideGeofence(lat?: number, lng?: number) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new BadRequestException('Thiếu tọa độ GPS (lat, lng) để check-in');
    }
    const office = await ensureDefaultGeofence(this.prisma);
    const distance = Math.round(haversineMeters(lat!, lng!, office.lat, office.lng));
    if (distance > office.radiusM) {
      throw new ForbiddenException(
        `Bạn đang cách ${office.name} khoảng ${distance}m (giới hạn ${office.radiusM}m).`,
      );
    }
    return distance;
  }

  async checkInForUser(userId: string, coords: { lat?: number; lng?: number }) {
    const employeeId = await this.employeeIdFromUser(userId);
    const distance = await this.assertInsideGeofence(coords.lat, coords.lng);
    const location = `GPS ${coords.lat!.toFixed(5)},${coords.lng!.toFixed(5)} (${distance}m)`;
    const today = vnDateUtc();
    const holidays = await loadHolidays(
      this.prisma,
      today,
      new Date(today.getTime() + DAY_MS),
    );
    const dayType = dayTypeFor(today, holidays);

    const existing = await this.prisma.attendance.findUnique({
      where: { employeeId_date: { employeeId, date: today } },
    });

    if (existing?.checkIn) {
      throw new ConflictException('Đã check-in hôm nay rồi');
    }

    const now = new Date();
    // Đi muộn chỉ có nghĩa với ngày làm việc thường — cuối tuần/ngày lễ là tăng ca.
    const status =
      dayType === 'NORMAL' && vnMinutesOfDay(now) > LATE_CUTOFF_MINUTES
        ? 'LATE'
        : 'PRESENT';

    if (existing) {
      return this.prisma.attendance.update({
        where: { id: existing.id },
        data: { checkIn: now, status, location, dayType },
      });
    }

    try {
      return await this.prisma.attendance.create({
        data: {
          employeeId,
          date: today,
          checkIn: now,
          status,
          location,
          dayType,
        },
      });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        throw new ConflictException('Đã check-in hôm nay rồi');
      }
      throw err;
    }
  }

  async checkOutForUser(userId: string) {
    const employeeId = await this.employeeIdFromUser(userId);
    const today = vnDateUtc();
    const holidays = await loadHolidays(
      this.prisma,
      today,
      new Date(today.getTime() + DAY_MS),
    );

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
    const dayType = dayTypeFor(today, holidays);

    // Giờ làm thực (từ check-in đến check-out, không trừ trưa) — chỉ để hiển thị.
    const workHours =
      Math.round(((now.getTime() - checkIn.getTime()) / 3_600_000) * 100) / 100;

    let workDays: number;
    let overtime: number;

    if (dayType !== 'NORMAL') {
      // Làm cuối tuần / ngày lễ: TOÀN BỘ giờ là tăng ca (2x / 3x), không phải ngày công.
      // Trừ 1h nghỉ trưa nếu khoảng làm việc đi qua 12:00–13:00.
      const spansLunch =
        vnMinutesOfDay(checkIn) < 13 * 60 && vnMinutesOfDay(now) >= 12 * 60;
      overtime =
        Math.round(Math.max(0, workHours - (spansLunch ? 1 : 0)) * 100) / 100;
      workDays = 0;
    } else {
      // Ngày thường: số công = phút trong khung 8–12 & 13–17 / 480, tối đa 1 công.
      const workMinutes = workMinutesOn(today, checkIn, now);
      workDays = roundQuarter(Math.min(workMinutes / WORK_DAILY_MINUTES, 1));

      // Tăng ca thật = thời gian ngoài khung 8–17h (trước 8h / sau 17h).
      const startOfWork = new Date(today);
      startOfWork.setHours(WORK_START_HOUR, WORK_START_MIN, 0, 0);
      const endOfWork = new Date(today);
      endOfWork.setHours(WORK_END_HOUR, WORK_END_MIN, 0, 0);
      const beforeMinutes = Math.max(
        0,
        (startOfWork.getTime() - checkIn.getTime()) / 60_000,
      );
      const afterMinutes = Math.max(
        0,
        (now.getTime() - endOfWork.getTime()) / 60_000,
      );
      const actualOtHours =
        Math.round(((beforeMinutes + afterMinutes) / 60) * 100) / 100;

      // Có đơn OT đã duyệt cho hôm nay → lấy max(đơn, thực tế), không cắt trần.
      const otRequest = await this.prisma.leaveRequest.findFirst({
        where: {
          employeeId,
          type: 'OT',
          status: 'APPROVED',
          overtimeDate: { gte: today, lte: today },
        },
        orderBy: { createdAt: 'desc' },
      });
      const approvedOt = otRequest?.overtimeHours ?? 0;
      overtime = Math.max(approvedOt, actualOtHours);
    }

    return this.prisma.attendance.update({
      where: { id: attendance.id },
      data: {
        checkOut: now,
        workHours,
        workDays,
        overtime,
        dayType,
      },
    });
  }

  async getMonthlyReport(employeeId: string, month: number, year: number) {
    const attendances = await this.findByEmployee(employeeId, month, year);

    const totalWorkHours = attendances.reduce(
      (sum, a) => sum + (a.workHours ?? 0),
      0,
    );
    const totalWorkDays = attendances.reduce(
      (sum, a) => sum + (a.workDays ?? 0),
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
        totalWorkDays: Math.round(totalWorkDays * 100) / 100,
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
    const dayStart = vnDateUtc(date);
    const holidays = await loadHolidays(
      this.prisma,
      dayStart,
      new Date(dayStart.getTime() + DAY_MS),
    );
    const dayType = dayTypeFor(dayStart, holidays);

    // Sửa tay phải quy ra ngày công — nếu để null thì bảng lương hiểu nhầm 1 công.
    const workDays =
      data.status === undefined
        ? undefined
        : data.status === 'HALF_DAY'
          ? 0.5
          : data.status === 'ABSENT' || data.status === 'ON_LEAVE'
            ? 0
            : 1;

    const payload = {
      ...data,
      dayType,
      ...(workDays !== undefined ? { workDays } : {}),
    };

    return this.prisma.attendance.upsert({
      where: { employeeId_date: { employeeId, date: dayStart } },
      create: { employeeId, date: dayStart, ...payload } as any,
      update: payload as any,
    });
  }
}
