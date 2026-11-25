import { EmployeesService } from './employees.service';
import { validatePasswordPolicy } from '../auth/password-policy';

/**
 * Test cho POST /employees/:id/reset-password — "Admin đặt lại mật khẩu nhân viên".
 *
 * Bảo vệ 4 rủi ro lớn nhất của tính năng này:
 * 1. Đặt nhầm cho ADMIN (phải từ chối — mật khẩu admin chỉ tự đổi)
 * 2. Đặt cho placeholder chưa kích hoạt (phải từ chối)
 * 3. MANUAL mật khẩu yếu phải bị SecurityPolicy chặn
 * 4. Audit log KHÔNG ĐƯỢC chứa mật khẩu thật (chỉ mask)
 * + Thu hồi toàn bộ refresh token của nhân viên sau khi đặt lại.
 */

const POLICY = {
  id: 'default',
  passwordMinLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireDigit: true,
  requireSpecial: false,
  passwordMaxAgeDays: 0,
  maxFailedAttempts: 5,
  lockoutMinutes: 15,
  accessTokenTtlHours: 720,
};

const EMP_ACTIVE = {
  id: 'e1',
  fullName: 'Nguyễn Văn A',
  employeeCode: 'EMP0007',
  user: { id: 'u1', email: 'nva@company.com', role: 'EMPLOYEE', isActive: true },
};

const EMP_ADMIN = {
  id: 'e2',
  fullName: 'Trần B (Admin)',
  employeeCode: 'EMP0002',
  user: { id: 'u9', email: 'admin@company.com', role: 'ADMIN', isActive: true },
};

const EMP_PLACEHOLDER = {
  id: 'e3',
  fullName: 'Lê C (chưa cấp TK)',
  employeeCode: 'EMP0003',
  user: { id: 'u3', email: 'le.c@company.com', role: 'EMPLOYEE', isActive: false },
};

function buildService(employeeRow: unknown) {
  const prisma: Record<string, any> = {
    employee: { findUnique: jest.fn().mockResolvedValue(employeeRow) },
    securityPolicy: { findUnique: jest.fn().mockResolvedValue(POLICY) },
    user: { update: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'u1', ...data })) },
    refreshToken: { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) },
    $transaction: jest.fn().mockImplementation(async (ops: any[]) => Promise.all(ops)),
  };
  const audit = { logAction: jest.fn().mockResolvedValue(1) };
  const service = new EmployeesService(prisma as any, audit as any);
  return { service, prisma, audit };
}

const ADMIN = { id: 'admin-1', email: 'hr.admin@company.com' };

describe('EmployeesService.resetPassword — admin đặt lại mật khẩu nhân viên', () => {
  it('GENERATE: hash bcrypt + cập nhật passwordChangedAt + thu hồi toàn bộ refresh token + trả plaintext 1 lần', async () => {
    const { service, prisma, audit } = buildService(EMP_ACTIVE);

    const result = await service.resetPassword('e1', { mode: 'GENERATE' }, ADMIN);

    // Mật khẩu sinh ra phải đạt đúng SecurityPolicy đang cấu hình
    expect(result.generatedPassword).toBeDefined();
    expect(validatePasswordPolicy(result.generatedPassword!, POLICY)).toEqual([]);
    expect(result.generatedPassword!.length).toBeGreaterThanOrEqual(12);

    // user.update: hash khớp với plaintext, có passwordChangedAt
    const updateArg = prisma.user.update.mock.calls[0][0];
    expect(updateArg.where).toEqual({ id: 'u1' });
    expect(await bcryptCompare(result.generatedPassword!, updateArg.data.passwordHash)).toBe(true);
    expect(updateArg.data.passwordChangedAt).toBeInstanceOf(Date);

    // Thu hồi phiên: deleteMany theo userId của nhân viên
    expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);

    // Audit: có ghi, giá trị là MASK — không bao giờ chứa plaintext
    expect(audit.logAction).toHaveBeenCalledTimes(1);
    const auditArg = audit.logAction.mock.calls[0][0];
    expect(auditArg.section).toBe('account');
    expect(auditArg.field).toBe('password');
    expect(auditArg.newValue).toContain('EMP0007');
    expect(auditArg.newValue).toContain('nva@company.com');
    expect(auditArg.oldValue).not.toContain(result.generatedPassword!);
    expect(auditArg.newValue).not.toContain(result.generatedPassword!);
  });

  it('MANUAL: mật khẩu đạt chính sách → lưu được, so khớp bcrypt đúng, không trả plaintext trong response', async () => {
    const { service, prisma } = buildService(EMP_ACTIVE);

    const result = await service.resetPassword('e1', { mode: 'MANUAL', newPassword: 'MatKhau@123' }, ADMIN);

    expect(result.generatedPassword).toBeUndefined(); // MANUAL không trả mật khẩu về client
    const savedHash = prisma.user.update.mock.calls[0][0].data.passwordHash;
    expect(await bcryptCompare('MatKhau@123', savedHash)).toBe(true);
  });

  it('MANUAL: mật khẩu yếu (thiếu chữ hoa/số) → từ chối theo SecurityPolicy, KHÔNG đụng vào user.update', async () => {
    const { service, prisma, audit } = buildService(EMP_ACTIVE);

    await expect(
      service.resetPassword('e1', { mode: 'MANUAL', newPassword: 'yeuqua' }, ADMIN),
    ).rejects.toThrow('chưa đạt yêu cầu');

    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.refreshToken.deleteMany).not.toHaveBeenCalled();
    expect(audit.logAction).not.toHaveBeenCalled(); // không lưu vết thao tác thất bại như thành công
  });

  it('MANUAL: thiếu newPassword → BadRequest, không thay đổi gì', async () => {
    const { service, prisma } = buildService(EMP_ACTIVE);

    await expect(service.resetPassword('e1', { mode: 'MANUAL' }, ADMIN)).rejects.toThrow(
      'Chưa nhập mật khẩu mới',
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('Từ chối đặt lại mật khẩu cho tài khoản ADMIN', async () => {
    const { service, prisma, audit } = buildService(EMP_ADMIN);

    await expect(service.resetPassword('e2', { mode: 'GENERATE' }, ADMIN)).rejects.toThrow(
      'Chỉ được đặt lại mật khẩu cho tài khoản EMPLOYEE',
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(audit.logAction).not.toHaveBeenCalled();
  });

  it('Từ chối nhân viên chưa có tài khoản kích hoạt (placeholder isActive=false)', async () => {
    const { service, prisma } = buildService(EMP_PLACEHOLDER);

    await expect(service.resetPassword('e3', { mode: 'GENERATE' }, ADMIN)).rejects.toThrow(
      'chưa có tài khoản đang kích hoạt',
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('Từ chối khi nhân viên không tồn tại', async () => {
    const { service, prisma } = buildService(null);

    await expect(service.resetPassword('missing', { mode: 'GENERATE' }, ADMIN)).rejects.toThrow(
      'Không tìm thấy nhân viên',
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});

describe('EmployeesService.update & updateAccount — bảo mật & toàn vẹn dữ liệu', () => {
  it('update: lọc bỏ các field lạ (chống mass-assignment) và không bật isActive cho tài khoản placeholder', async () => {
    const tx = {
      employee: {
        update: jest.fn().mockImplementation(({ data }: any) =>
          Promise.resolve({ id: 'e3', userId: 'u3', ...data }),
        ),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          email: 'le.c@company.com.placeholder.12345678',
        }),
        update: jest.fn(),
      },
      refreshToken: { deleteMany: jest.fn() },
      contract: {
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    };
    const prisma = {
      $transaction: jest.fn().mockImplementation((fn: any) => fn(tx)),
    };
    const service = new EmployeesService(prisma as any, { logAction: jest.fn() } as any);

    await service.update('e3', {
      fullName: 'Lê C Mới',
      status: 'ACTIVE',
      // Các trường nhạy cảm cố tình chèn vào body
      ...({ userId: 'hacked-user', employeeCode: 'EMP9999', role: 'ADMIN' } as any),
    });

    const passedData = tx.employee.update.mock.calls[0][0].data;
    expect(passedData.fullName).toBe('Lê C Mới');
    expect(passedData.status).toBe('ACTIVE');
    expect(passedData.userId).toBeUndefined();
    expect(passedData.employeeCode).toBeUndefined();
    expect(passedData.role).toBeUndefined();
    // Placeholder user KHÔNG được tự động bật isActive = true khi chuyển sang ACTIVE
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it('update: chặn tự gán quản lý trực tiếp là chính mình (managerId === id)', async () => {
    const service = new EmployeesService({} as any, {} as any);
    await expect(service.update('e1', { managerId: 'e1' })).rejects.toThrow(
      'quản lý trực tiếp của chính mình',
    );
  });

  it('updateAccount: đồng bộ email cả bảng employees lẫn users, xóa OAuth UID cũ và không bật lại user của nhân viên TERMINATED', async () => {
    const tx = {
      employee: { update: jest.fn().mockResolvedValue({}) },
      user: {
        update: jest.fn().mockImplementation(({ data }: any) =>
          Promise.resolve({ id: 'u1', ...data }),
        ),
      },
      refreshToken: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    const prisma = {
      employee: {
        findUnique: jest.fn().mockResolvedValue({
          userId: 'u1',
          email: 'old@company.com',
          status: 'TERMINATED',
          user: { email: 'old@company.com' },
        }),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      user: { findFirst: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn().mockImplementation((fn: any) => fn(tx)),
    };
    const service = new EmployeesService(prisma as any, {} as any);

    await service.updateAccount('e1', { email: 'new@company.com' });

    expect(tx.employee.update).toHaveBeenCalledWith({
      where: { id: 'e1' },
      data: { email: 'new@company.com' },
    });
    const userUpdateData = tx.user.update.mock.calls[0][0].data;
    expect(userUpdateData.email).toBe('new@company.com');
    expect(userUpdateData.firebaseUid).toBeNull();
    expect(userUpdateData.googleId).toBeNull();
    expect(userUpdateData.facebookId).toBeNull();
    // Nhân viên đã TERMINATED → không được gán isActive = true
    expect(userUpdateData.isActive).toBeUndefined();
  });

  it('update: chuyển trạng thái sang ACTIVE tự động kích hoạt lại hợp đồng gần nhất và nâng PROBATION -> FULL_TIME', async () => {
    const tx = {
      employee: {
        update: jest.fn().mockImplementation(({ data }: any) =>
          Promise.resolve({ id: 'e1', userId: 'u1', ...data }),
        ),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({ email: 'nva@company.com' }),
        update: jest.fn(),
      },
      refreshToken: { deleteMany: jest.fn() },
      contract: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(null) // hasActiveContract = null
          .mockResolvedValueOnce({ id: 'ctr-1', type: 'PROBATION' }), // latestContract
        update: jest.fn().mockResolvedValue({ id: 'ctr-1', isActive: true, type: 'FULL_TIME' }),
        updateMany: jest.fn(),
      },
    };
    const prisma = {
      $transaction: jest.fn().mockImplementation((fn: any) => fn(tx)),
    };
    const service = new EmployeesService(prisma as any, { logAction: jest.fn() } as any);

    await service.update('e1', { status: 'ACTIVE' });

    expect(tx.contract.update).toHaveBeenCalledWith({
      where: { id: 'ctr-1' },
      data: { isActive: true, type: 'FULL_TIME' },
    });
  });
});

/** bcryptjs được service dùng nội bộ — test so khớp bằng chính thư viện này */
async function bcryptCompare(plain: string, hash: string): Promise<boolean> {
  const bcrypt = await import('bcryptjs');
  return bcrypt.compare(plain, hash);
}
