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

/** bcryptjs được service dùng nội bộ — test so khớp bằng chính thư viện này */
async function bcryptCompare(plain: string, hash: string): Promise<boolean> {
  const bcrypt = await import('bcryptjs');
  return bcrypt.compare(plain, hash);
}
