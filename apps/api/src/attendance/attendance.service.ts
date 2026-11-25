import {
  Injectable,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { vnDateUtc, vnMonthRange, vnMinutesOfDay, vnTimeOnDate } from '../common/vn-date';
import { dayTypeFor } from '../common/workdays';
import { loadHolidays } from '../common/holidays';
import { ensureDefaultGeofence } from '../settings/single-row.utils';

const DAY_MS = 24 * 60 * 60 * 1000;
const WORK_START_HOUR = 8;
const WORK_START_MIN = 0;
const MORNING_END_HOUR = 12;
const MORNING_END_MIN = 0;
const AFTERNOON_START_HOUR = 13;
const AFTERNOON_START_MIN = 30;
const WORK_END_HOUR = 17;
const WORK_END_MIN = 30;
const WORK_DAILY_MINUTES = 8 * 60; // Ca sáng 08:00–12:00 (240p) + Ca chiều 13:30–17:30 (240p) = 480p
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

function roundWorkDays(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function minutesBetween(a: Date, b: Date): number {
  return Math.max(0, Math.floor((b.getTime() - a.getTime()) / 60_000));
}

/** Tổng phút ngày `d` nằm trong 2 ca làm việc (08:00–12:00 & 13:30–17:30) theo giờ VN (+07:00). */
export function workMinutesOn(date: Date, checkIn?: Date, checkOut?: Date): number {
  const start = checkIn ?? date;
  const end = checkOut ?? date;
  if (end <= start) return 0;
  const morningStart = vnTimeOnDate(date, WORK_START_HOUR, WORK_START_MIN);
  const morningEnd = vnTimeOnDate(date, MORNING_END_HOUR, MORNING_END_MIN);
  const afternoonStart = vnTimeOnDate(date, AFTERNOON_START_HOUR, AFTERNOON_START_MIN);
  const afternoonEnd = vnTimeOnDate(date, WORK_END_HOUR, WORK_END_MIN);
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

/** Tính số công ngày thường từ thời điểm checkIn/checkOut: phút trong 2 ca / 480 (giữ 4 chữ số thập phân) */
export function workDaysFromTimestamps(date: Date, checkIn: Date, checkOut: Date): number {
  const workMinutes = workMinutesOn(date, checkIn, checkOut);
  return roundWorkDays(Math.min(workMinutes / WORK_DAILY_MINUTES, 1));
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
    // Mock tạm (ATTENDANCE_GEOFENCE_MOCK=true trong apps/api/.env): mọi vị trí đều check-in được, kể cả không có GPS
    if (process.env.ATTENDANCE_GEOFENCE_MOCK === 'true') return null;
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
    const hasCoords = Number.isFinite(coords.lat) && Number.isFinite(coords.lng);
    const location =
      distance !== null
        ? `GPS ${coords.lat!.toFixed(5)},${coords.lng!.toFixed(5)} (${distance}m)`
        : hasCoords
          ? `GPS ${coords.lat!.toFixed(5)},${coords.lng!.toFixed(5)} (mock, bỏ qua geofence)`
          : 'Mock (không có GPS, bỏ qua geofence)';
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
    // Ngày đã có đơn nghỉ được duyệt: chấm công nữa sẽ bị trả lương hai lần
    // (công chấm được + ngày phép/công tác của đơn).
    if (existing?.status === 'ON_LEAVE') {
      throw new ConflictException(
        'Hôm nay bạn có đơn nghỉ đã được duyệt — liên hệ HR nếu bạn vẫn đi làm',
      );
    }

    const now = new Date();
    // Đi muộn chỉ có nghĩa với ngày làm việc thường — cuối tuần/ngày lễ là tăng ca.
    let status: 'LATE' | 'PRESENT' =
      dayType === 'NORMAL' && vnMinutesOfDay(now) > LATE_CUTOFF_MINUTES
        ? 'LATE'
        : 'PRESENT';
    // Đã có đơn đến muộn / về sớm được duyệt cho hôm nay → không tính đi muộn
    if (status === 'LATE') {
      const permitted = await this.prisma.leaveRequest.findFirst({
        where: {
          employeeId,
          type: 'LATE_PERMISSION',
          status: 'APPROVED',
          startDate: { lte: today },
          endDate: { gte: today },
        },
        select: { id: true },
      });
      if (permitted) status = 'PRESENT';
    }

    if (existing) {
      return this.prisma.attendance.update({
        where: { id: existing.id },
        data: { checkIn: now, status, location, dayType, workDays: 0 },
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
          workDays: 0,
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
      // Trừ phần thời gian thực tế giao với khung nghỉ trưa 12:00–13:30 giờ VN.
      const lunchStart = vnTimeOnDate(today, MORNING_END_HOUR, MORNING_END_MIN);
      const lunchEnd = vnTimeOnDate(today, AFTERNOON_START_HOUR, AFTERNOON_START_MIN);
      const lunchOverlapHours =
        minutesBetween(
          checkIn > lunchStart ? checkIn : lunchStart,
          now < lunchEnd ? now : lunchEnd,
        ) / 60;
      overtime =
        Math.round(Math.max(0, workHours - lunchOverlapHours) * 100) / 100;
      workDays = 0;
    } else {
      // Ngày thường: số công = phút trong khung 08:00–12:00 & 13:30–17:30 / 480, tối đa 1 công.
      workDays = workDaysFromTimestamps(today, checkIn, now);

      // Tăng ca ngày thường: chỉ lấy từ đơn OT đã duyệt (hoặc giờ làm ngoài khung khi có đơn OT),
      // tránh việc check-in sớm 5-10 phút lúc 07:55 hay check-out muộn vài phút bị cộng nhầm thành OT.
      const otRequest = await this.prisma.leaveRequest.findFirst({
        where: {
          employeeId,
          type: 'OT',
          status: 'APPROVED',
          OR: [
            { overtimeDate: { gte: today, lte: today } },
            { overtimeDate: null, startDate: { lte: today }, endDate: { gte: today } },
          ],
        },
        orderBy: { createdAt: 'desc' },
      });
      if (otRequest) {
        const startOfWork = vnTimeOnDate(today, WORK_START_HOUR, WORK_START_MIN);
        const endOfWork = vnTimeOnDate(today, WORK_END_HOUR, WORK_END_MIN);
        const beforeEnd = now < startOfWork ? now : startOfWork;
        const beforeMinutes = minutesBetween(checkIn, beforeEnd);
        const afterStart = checkIn > endOfWork ? checkIn : endOfWork;
        const afterMinutes = minutesBetween(afterStart, now);
        const actualOtHours =
          Math.round(((beforeMinutes + afterMinutes) / 60) * 100) / 100;
        overtime = Math.max(otRequest.overtimeHours ?? 0, actualOtHours);
      } else {
        // Nếu đi làm hoàn toàn ngoài giờ hành chính (vd ca tối check-in >= 17:30), vẫn ghi nhận giờ OT thực tế
        const startOfWork = vnTimeOnDate(today, WORK_START_HOUR, WORK_START_MIN);
        const endOfWork = vnTimeOnDate(today, WORK_END_HOUR, WORK_END_MIN);
        if (checkIn >= endOfWork || now <= startOfWork) {
          const beforeEnd = now < startOfWork ? now : startOfWork;
          const beforeMinutes = minutesBetween(checkIn, beforeEnd);
          const afterStart = checkIn > endOfWork ? checkIn : endOfWork;
          const afterMinutes = minutesBetween(afterStart, now);
          overtime = Math.round(((beforeMinutes + afterMinutes) / 60) * 100) / 100;
        } else {
          overtime = 0;
        }
      }
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
    const totalWorkDays = attendances.reduce((sum, a) => {
      if (a.status === 'ON_LEAVE' || a.status === 'ABSENT') return sum;
      if (a.dayType && a.dayType !== 'NORMAL') return sum;
      if (a.checkIn && a.checkOut && a.status !== 'HALF_DAY') {
        return sum + workDaysFromTimestamps(a.date, a.checkIn, a.checkOut);
      }
      if (a.workDays !== null && a.workDays !== undefined) return sum + a.workDays;
      // Mới check-in, chưa check-out → chưa chốt công
      if (a.checkIn && !a.checkOut) return sum;
      return sum + (a.status === 'HALF_DAY' ? 0.5 : 1);
    }, 0);
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
        totalWorkDays: Math.round(totalWorkDays * 10000) / 10000,
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
    const month = dayStart.getUTCMonth() + 1;
    const year = dayStart.getUTCFullYear();
    const lockedPayroll = await this.prisma.payroll.findUnique({
      where: { employeeId_month_year: { employeeId, month, year } },
      select: { status: true },
    });
    if (
      lockedPayroll &&
      (lockedPayroll.status === 'APPROVED' || lockedPayroll.status === 'PAID')
    ) {
      throw new BadRequestException(
        `Kỳ lương tháng ${month}/${year} đã chốt (${lockedPayroll.status}) — không thể sửa chấm công`,
      );
    }

    const holidays = await loadHolidays(
      this.prisma,
      dayStart,
      new Date(dayStart.getTime() + DAY_MS),
    );
    const dayType = dayTypeFor(dayStart, holidays);

    // Sửa tay phải quy ra ngày công — ngày lễ/cuối tuần chỉ tính tăng ca (0 công),
    // ngày thường quy theo trạng thái để bảng lương không hiểu nhầm.
    const workDays =
      data.status === undefined
        ? undefined
        : dayType !== 'NORMAL'
          ? 0
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
