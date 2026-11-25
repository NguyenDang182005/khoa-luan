import { AttendanceService } from './attendance.service';
import { vnDateUtc } from '../common/vn-date';

describe('AttendanceService — checkOutForUser & upsertRecord', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('checkOutForUser: làm thêm buổi tối (checkIn 18:00, checkOut 19:00 giờ VN) chỉ tính đúng 1 giờ OT (không tính lố từ 17:00)', async () => {
    // Đặt giờ hệ thống tại 19:00 ngày 09/09/2026 giờ VN (Thứ Tư)
    const now = new Date('2026-09-09T19:00:00.000+07:00');
    jest.setSystemTime(now);
    const checkIn = new Date('2026-09-09T18:00:00.000+07:00');
    const today = vnDateUtc(now);

    const prisma = {
      employee: { findUnique: jest.fn().mockResolvedValue({ id: 'emp-1' }) },
      holiday: { findMany: jest.fn().mockResolvedValue([]) },
      attendance: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'att-1',
          employeeId: 'emp-1',
          date: today,
          checkIn,
          checkOut: null,
        }),
        update: jest.fn().mockImplementation(({ data }: any) => Promise.resolve(data)),
      },
      leaveRequest: { findFirst: jest.fn().mockResolvedValue(null) },
    };

    const service = new AttendanceService(prisma as any);
    const updated = await service.checkOutForUser('user-1');

    expect(updated.workDays).toBe(0); // Ngoài khung 8-17h
    expect(updated.overtime).toBe(1); // Đúng 1 tiếng (18h -> 19h), không phải 2 tiếng (17h -> 19h)
  });

  it('checkOutForUser: làm cuối tuần lẹm 15 phút vào khung nghỉ trưa (11:30 -> 12:15) chỉ trừ đúng 15 phút nghỉ trưa, còn 0.5h OT', async () => {
    // Thứ Bảy 05/09/2026
    const now = new Date('2026-09-05T12:15:00.000+07:00');
    jest.setSystemTime(now);
    const checkIn = new Date('2026-09-05T11:30:00.000+07:00');
    const today = vnDateUtc(now);

    const prisma = {
      employee: { findUnique: jest.fn().mockResolvedValue({ id: 'emp-1' }) },
      holiday: { findMany: jest.fn().mockResolvedValue([]) },
      attendance: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'att-sat',
          employeeId: 'emp-1',
          date: today,
          checkIn,
          checkOut: null,
        }),
        update: jest.fn().mockImplementation(({ data }: any) => Promise.resolve(data)),
      },
    };

    const service = new AttendanceService(prisma as any);
    const updated = await service.checkOutForUser('user-1');

    expect(updated.dayType).toBe('WEEKEND');
    expect(updated.workDays).toBe(0);
    expect(updated.overtime).toBe(0.5); // 45p tổng - 15p giao với 12:00-13:00 = 30p = 0.5h
  });

  it('upsertRecord: chặn sửa chấm công khi kỳ lương của tháng đó đã APPROVED hoặc PAID', async () => {
    const prisma = {
      payroll: {
        findUnique: jest.fn().mockResolvedValue({ status: 'APPROVED' }),
      },
    };
    const service = new AttendanceService(prisma as any);

    await expect(
      service.upsertRecord('emp-1', new Date('2026-09-10T00:00:00.000Z'), {
        status: 'PRESENT',
      }),
    ).rejects.toThrow('đã chốt');
  });

  it('checkInForUser: khi mới check-in (chưa check-out), workDays khởi tạo bằng 0 để không tính nhầm 1.0 công', async () => {
    const now = new Date('2026-11-05T15:00:00.000+07:00');
    jest.setSystemTime(now);
    const prisma = {
      employee: { findUnique: jest.fn().mockResolvedValue({ id: 'emp-1' }) },
      holiday: { findMany: jest.fn().mockResolvedValue([]) },
      attendance: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve(data)),
      },
      leaveRequest: { findFirst: jest.fn().mockResolvedValue(null) },
      officeGeofence: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'default',
          name: 'VP',
          lat: 10.7769,
          lng: 106.7009,
          radiusM: 200,
        }),
      },
    };
    const service = new AttendanceService(prisma as any);
    const created = await service.checkInForUser('user-1', {
      lat: 10.7769,
      lng: 106.7009,
    });

    expect(created.status).toBe('LATE');
    expect(created.workDays).toBe(0);
  });

  it('checkOutForUser: kẹp đúng 2 ca (08:00–12:00 & 13:30–17:30): đi sớm 07:55 -> 12:09 = 0.5 công; về sớm 07:50 -> 10:00 = 0.25 công; chiều 14:30 -> 17:30 = 0.375 công; 14:00 -> 15:30 = 0.1875 công', async () => {
    const today = vnDateUtc(new Date('2026-11-05T14:00:00.000+07:00'));

    const runCase = async (checkInIso: string, checkOutIso: string) => {
      const checkIn = new Date(checkInIso);
      const now = new Date(checkOutIso);
      jest.setSystemTime(now);
      const prisma = {
        employee: { findUnique: jest.fn().mockResolvedValue({ id: 'emp-1' }) },
        holiday: { findMany: jest.fn().mockResolvedValue([]) },
        attendance: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'att-exact',
            employeeId: 'emp-1',
            date: today,
            checkIn,
            checkOut: null,
          }),
          update: jest.fn().mockImplementation(({ data }: any) => Promise.resolve(data)),
        },
        leaveRequest: { findFirst: jest.fn().mockResolvedValue(null) },
      };
      const service = new AttendanceService(prisma as any);
      return service.checkOutForUser('user-1');
    };

    // 1. Check-in sớm 07:55, check-out 12:09 -> kẹp [08:00, 12:00] = 240p / 480p = 0.5 công (0 OT)
    const morningHalf = await runCase(
      '2026-11-05T07:55:00.000+07:00',
      '2026-11-05T12:09:00.000+07:00',
    );
    expect(morningHalf.workDays).toBe(0.5);
    expect(morningHalf.overtime).toBe(0);

    // 2. Check-in sớm 07:50, check-out lúc 10:00 -> kẹp [08:00, 10:00] = 120p / 480p = 0.25 công
    const earlyCheckout = await runCase(
      '2026-11-05T07:50:00.000+07:00',
      '2026-11-05T10:00:00.000+07:00',
    );
    expect(earlyCheckout.workDays).toBe(0.25);

    // 3. Làm cả ngày (check-in 07:55, check-out 17:40) -> sáng 240p + chiều (13:30-17:30) 240p = 480p = 1.0 công
    const fullDay = await runCase(
      '2026-11-05T07:55:00.000+07:00',
      '2026-11-05T17:40:00.000+07:00',
    );
    expect(fullDay.workDays).toBe(1);

    // 4. 3 tiếng buổi chiều (14:30 -> 17:30) = 180 / 480 = 0.375 công
    const threeHours = await runCase(
      '2026-11-05T14:30:00.000+07:00',
      '2026-11-05T17:30:00.000+07:00',
    );
    expect(threeHours.workDays).toBe(0.375);

    // 5. 1.5 tiếng buổi chiều (14:00 -> 15:30) = 90 / 480 = 0.1875 công
    const oneHalfHours = await runCase(
      '2026-11-05T14:00:00.000+07:00',
      '2026-11-05T15:30:00.000+07:00',
    );
    expect(oneHalfHours.workDays).toBe(0.1875);

    // 6. Check-in xong check-out luôn (chênh 2 giây) = 0 công
    const instant = await runCase(
      '2026-11-05T15:00:00.000+07:00',
      '2026-11-05T15:00:02.000+07:00',
    );
    expect(instant.workDays).toBe(0);
  });
});
