import { LeaveService } from './leave.service';
import { vnDateFromParts } from '../common/vn-date';

describe('LeaveService — hủy đơn đã duyệt & phép năm vắt qua 2 năm', () => {
  it('cancel: ADMIN hủy được đơn APPROVED, tự động xóa các bản ghi chấm công ON_LEAVE chưa check-in', async () => {
    const start = vnDateFromParts(2026, 9, 10);
    const end = vnDateFromParts(2026, 9, 11);
    const tx = {
      attendance: { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) },
      leaveRequest: {
        update: jest.fn().mockImplementation(({ data }: any) =>
          Promise.resolve({ id: 'lr-1', ...data }),
        ),
      },
    };
    const prisma = {
      leaveRequest: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'lr-1',
          employeeId: 'emp-1',
          type: 'ANNUAL',
          status: 'APPROVED',
          startDate: start,
          endDate: end,
          overtimeDate: null,
        }),
      },
      payroll: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn().mockImplementation((fn: any) => fn(tx)),
    };

    const service = new LeaveService(prisma as any);
    const res = await service.cancel('lr-1', 'admin-user', true);

    expect(res.status).toBe('CANCELLED');
    expect(tx.attendance.deleteMany).toHaveBeenCalledWith({
      where: {
        employeeId: 'emp-1',
        date: { gte: start, lte: end },
        status: 'ON_LEAVE',
        checkIn: null,
      },
    });
  });

  it('cancel: Nhân viên thường không thể hủy đơn đã APPROVED', async () => {
    const prisma = {
      leaveRequest: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'lr-1',
          employeeId: 'emp-1',
          type: 'ANNUAL',
          status: 'APPROVED',
        }),
      },
      employee: {
        findUnique: jest.fn().mockResolvedValue({ id: 'emp-1' }),
      },
    };

    const service = new LeaveService(prisma as any);
    await expect(service.cancel('lr-1', 'user-1', false)).rejects.toThrow(
      'Chỉ có thể hủy đơn đang chờ xét duyệt',
    );
  });

  it('create: đơn ANNUAL vắt qua 2 năm (30/12/2026 -> 04/01/2027) kiểm tra riêng quỹ phép từng năm', async () => {
    const prisma = {
      holiday: { findMany: jest.fn().mockResolvedValue([]) },
      leaveRequest: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve(data)),
      },
    };
    const service = new LeaveService(prisma as any);
    // Giả sử năm 2026 chỉ còn 2 ngày phép (đủ cho 30-31/12/2026 = 2 ngày), năm 2027 còn 12 ngày (đủ cho 01 & 04/01/2027 = 2 ngày).
    // Tổng đơn là 4 ngày (> 2 ngày của 2026), nhưng tách theo năm thì cả 2 năm đều ĐỦ!
    jest.spyOn(service, 'getBalance').mockImplementation(async (_empId, year) => ({
      year,
      quota: 12,
      seniorityBonus: 0,
      proratedMonths: null,
      carryOver: 0,
      total: 12,
      used: year === 2026 ? 10 : 0,
      remaining: year === 2026 ? 2 : 12,
    }));

    const created = await service.create({
      employeeId: 'emp-1',
      type: 'ANNUAL',
      startDate: new Date('2026-12-30T00:00:00.000Z'),
      endDate: new Date('2027-01-04T00:00:00.000Z'),
      reason: 'Nghỉ Tết Dương lịch kết hợp phép',
    });

    expect(created.totalDays).toBe(4);
    expect(service.getBalance).toHaveBeenCalledWith('emp-1', 2026);
    expect(service.getBalance).toHaveBeenCalledWith('emp-1', 2027);
  });
});
