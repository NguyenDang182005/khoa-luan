import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { randomUUID, randomInt } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsAuditService } from '../settings/settings-audit.service';
import { ensureDefaultSecurityPolicy } from '../settings/single-row.utils';
import { validatePasswordPolicy } from '../auth/password-policy';

const EMPLOYMENT_STATUSES = ['ACTIVE', 'ON_LEAVE', 'TERMINATED', 'PROBATION'];
const GENDERS = ['MALE', 'FEMALE', 'OTHER'];

@Injectable()
export class EmployeesService {
  constructor(
    private prisma: PrismaService,
    private audit: SettingsAuditService,
  ) {}

  async findAll(params: {
    page?: number;
    limit?: number;
    search?: string;
    departmentId?: string;
    status?: string;
  }) {
    const { page = 1, limit = 10, search, departmentId, status } = params;
    // Chặn client xin cả bảng (limit=100000) làm nghẽn DB
    const take = Math.min(Math.max(limit, 1), 100);
    const skip = (Math.max(page, 1) - 1) * take;
    const where: any = {};

    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { employeeCode: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (departmentId) where.departmentId = departmentId;
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      this.prisma.employee.findMany({
        where,
        skip,
        take,
        include: {
          department: { select: { id: true, name: true, code: true } },
          position: { select: { id: true, title: true, code: true } },
          manager: {
            select: { id: true, fullName: true, employeeCode: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.employee.count({ where }),
    ]);

    return {
      success: true,
      data,
      meta: { total, page, limit: take, totalPages: Math.ceil(total / take) },
    };
  }

  async findByCode(employeeCode: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { employeeCode },
      include: {
        department: true,
        position: true,
        user: { select: { email: true, role: true, avatarUrl: true } },
      },
    });
    if (!employee) throw new NotFoundException(`Employee with code ${employeeCode} not found`);
    return employee;
  }

  /**
   * Chi tiết nhân viên. includePrivate = ADMIN mới được thấy hợp đồng (lương).
   * Nhân viên chỉ xem được hồ sơ của chính mình (CCCD/địa chỉ/ngày sinh là dữ liệu cá nhân).
   */
  async findOne(id: string, includePrivate = false, viewerUserId?: string | null) {
    const employee = await this.prisma.employee.findUniqueOrThrow({
      where: { id },
      include: {
        department: true,
        position: true,
        manager: { select: { id: true, fullName: true, employeeCode: true } },
        user: { select: { email: true, role: true, isActive: true, googleId: true, facebookId: true } },
        ...(includePrivate
          ? {
              contracts: {
                where: { isActive: true },
                take: 1,
                orderBy: { createdAt: 'desc' },
              },
            }
          : {}),
        onboardingProgress: {
          include: { task: true },
          orderBy: { task: { order: 'asc' } },
        },
      },
    });

    if (!includePrivate && viewerUserId && employee.userId !== viewerUserId) {
      throw new ForbiddenException(
        'Chỉ xem được hồ sơ của chính mình',
      );
    }
    return employee;
  }

  async create(dto: {
    userId?: string;
    fullName: string;
    email: string;
    phone?: string;
    gender?: string;
    dateOfBirth?: Date;
    address?: string;
    nationalId?: string;
    joinDate: Date;
    departmentId: string;
    positionId: string;
    managerId?: string;
    employeeCode?: string;
    role?: string;
    /** Lương cơ bản — nếu truyền, hệ thống tạo luôn hợp đồng thử việc để chạy được bảng lương */
    baseSalary?: number;
    allowances?: number;
  }) {
    const explicitCode = dto.employeeCode;
    let code = explicitCode ?? (await this.generateCode());

    const existing = await this.prisma.employee.findFirst({
      where: {
        OR: [
          { email: dto.email },
          ...(explicitCode ? [{ employeeCode: explicitCode }] : []),
        ],
      },
    });
    if (existing) {
      throw new ConflictException('Email hoặc mã nhân viên đã tồn tại');
    }
    if (dto.baseSalary !== undefined && !(dto.baseSalary > 0)) {
      throw new BadRequestException('Lương cơ bản phải lớn hơn 0');
    }

    // Nếu truyền role → tạo user active thật sự (email này là whitelist OAuth)
    // Không truyền role → tạo placeholder User inactive (không đăng nhập được)
    let resolvedUserId: string;
    if (dto.userId) {
      resolvedUserId = dto.userId;
    } else if (dto.role) {
      const emailTaken = await this.prisma.user.findUnique({
        where: { email: dto.email },
        select: { id: true },
      });
      if (emailTaken) {
        throw new ConflictException('Email đã có tài khoản đăng nhập');
      }
      resolvedUserId = await this.createActiveUser(dto.email, dto.role);
    } else {
      resolvedUserId = await this.createPlaceholderUser(dto.email);
    }

    const { role: _role, baseSalary, allowances, ...employeeData } = dto;

    const createEmployee = (employeeCode: string) =>
      this.prisma.$transaction(async (tx) => {
        const created = await tx.employee.create({
          data: {
            ...employeeData,
            userId: resolvedUserId,
            employeeCode,
            gender: employeeData.gender as any,
            status: 'PROBATION',
          },
        });

        // Tạo hợp đồng thử việc ngay khi tuyển dụng: nếu không có hợp đồng thì
        // calculatePayroll ném "chưa có hợp đồng active" và HR phải nhập tay ở màn khác.
        if (baseSalary && baseSalary > 0) {
          await tx.contract.create({
            data: {
              employeeId: created.id,
              contractNumber: `CTR-${employeeCode}-${Date.now().toString(36)}`,
              type: 'PROBATION',
              startDate: created.joinDate,
              baseSalary,
              allowances: allowances ?? 0,
              signedDate: created.joinDate,
              isActive: true,
            },
          });
        }
        return created;
      });

    let employee: Awaited<ReturnType<typeof createEmployee>> | undefined;
    for (let attempt = 0; attempt < 3 && !employee; attempt++) {
      try {
        employee = await createEmployee(code);
      } catch (err: any) {
        const target = err?.meta?.target;
        const codeConflict =
          err?.code === 'P2002' &&
          (!Array.isArray(target) || target.includes('employeeCode'));
        if (!explicitCode && codeConflict) {
          // Hai người tạo song song cùng mã → sinh lại mã mới rồi thử tiếp
          code = await this.generateCode();
          continue;
        }
        throw err;
      }
    }
    if (!employee) {
      throw new ConflictException(
        'Không sinh được mã nhân viên (đang có người tạo cùng lúc). Vui lòng thử lại.',
      );
    }

    // Auto-assign onboarding tasks
    await this.assignOnboardingTasks(employee.id);

    return employee;
  }

  async updateAccount(
    employeeId: string,
    dto: { email?: string; role?: string },
  ) {
    const VALID_ROLES = ['ADMIN', 'EMPLOYEE'];
    if (dto.role && !VALID_ROLES.includes(dto.role)) {
      throw new BadRequestException(
        `Role không hợp lệ — cho phép: ${VALID_ROLES.join(', ')}`,
      );
    }

    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: { userId: true },
    });
    if (!employee) throw new NotFoundException('Không tìm thấy nhân viên');

    // Kiểm tra email unique (nếu đổi email)
    if (dto.email) {
      const emailTaken = await this.prisma.user.findFirst({
        where: { email: dto.email, NOT: { id: employee.userId } },
      });
      if (emailTaken) throw new ConflictException('Email đã được sử dụng bởi tài khoản khác');
    }

    const updates: Record<string, any> = {};
    if (dto.email) updates.email = dto.email;
    if (dto.role) updates.role = dto.role;

    if (Object.keys(updates).length === 0) {
      throw new BadRequestException('Không có trường nào để cập nhật');
    }

    // Khi đổi email → kích hoạt user (có thể trước đây là placeholder inactive)
    if (dto.email) updates.isActive = true;

    const updatedUser = await this.prisma.user.update({
      where: { id: employee.userId },
      data: updates,
      select: { id: true, email: true, role: true, isActive: true, googleId: true, facebookId: true },
    });

    // Đổi email/role phải thu hồi phiên cũ: JWT cũ vẫn mang role/email trước đó
    // (nếu chỉ hạ quyền mà không thu hồi, token ADMIN còn hiệu lực tới 30 ngày).
    await this.prisma.refreshToken.deleteMany({
      where: { userId: employee.userId },
    });

    return updatedUser;
  }

  /**
   * Admin đặt lại mật khẩu cho nhân viên (POST /employees/:id/reset-password).
   *
   * Phễu quyền & điều kiện:
   * - Endpoint đã chặn bởi JwtAuthGuard + RolesGuard @Roles('ADMIN_GROUP')
   * - Target chỉ chấp nhận tài khoản EMPLOYEE đang kích hoạt:
   *   + role ADMIN → từ chối (admin tự đổi mật khẩu của mình ở Cài Đặt → Bảo Mật & Phiên)
   *   + user chưa kích hoạt (placeholder isActive=false) → từ chối (phải cấp tài khoản trước)
   *
   * Hành vi khi đặt lại:
   * - GENERATE: server sinh mật khẩu ngẫu nhiên đạt SecurityPolicy, trả plaintext ĐÚNG 1 LẦN
   * - MANUAL: validate newPassword theo SecurityPolicy
   * - Cập nhật passwordChangedAt + thu hồi TOÀN BỘ phiên (refresh token) của nhân viên
   * - Ghi audit log section 'account' — giá trị chỉ là mask, không bao giờ log mật khẩu thật
   */
  async resetPassword(
    employeeId: string,
    dto: { mode: 'GENERATE' | 'MANUAL'; newPassword?: string },
    admin: { id?: string; email?: string },
  ) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        fullName: true,
        employeeCode: true,
        user: { select: { id: true, email: true, role: true, isActive: true } },
      },
    });
    if (!employee || !employee.user) {
      throw new NotFoundException('Không tìm thấy nhân viên');
    }
    if (employee.user.role === 'ADMIN') {
      throw new BadRequestException(
        'Chỉ được đặt lại mật khẩu cho tài khoản EMPLOYEE — mật khẩu ADMIN tự đổi trong Cài Đặt → Bảo Mật & Phiên',
      );
    }
    if (!employee.user.isActive) {
      throw new BadRequestException(
        'Nhân viên chưa có tài khoản đang kích hoạt — dùng "Sửa Email & Role" để cấp tài khoản trước',
      );
    }

    const policy = await ensureDefaultSecurityPolicy(this.prisma);

    let newPassword: string;
    if (dto.mode === 'GENERATE') {
      newPassword = this.generatePolicyPassword(policy);
    } else {
      if (!dto.newPassword) {
        throw new BadRequestException('Chưa nhập mật khẩu mới cho chế độ MANUAL');
      }
      const errors = validatePasswordPolicy(dto.newPassword, policy);
      if (errors.length > 0) {
        throw new BadRequestException(
          `Mật khẩu chưa đạt yêu cầu: cần ${errors.join(', ')}.`,
        );
      }
      newPassword = dto.newPassword;
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: employee.user.id },
        data: { passwordHash, passwordChangedAt: new Date() },
      }),
      // Mật khẩu mới ⇒ mọi phiên cũ của nhân viên (mọi thiết bị) phải đăng nhập lại
      this.prisma.refreshToken.deleteMany({ where: { userId: employee.user.id } }),
    ]);

    // Audit — mask tuyệt đối, không log mật khẩu thật; lỗi audit không chặn nghiệp vụ
    await this.audit.logAction({
      section: 'account',
      admin,
      field: 'password',
      oldValue: '••••••',
      newValue: `đặt lại bởi admin — ${employee.employeeCode} (${employee.user.email})`,
    });

    return {
      message:
        dto.mode === 'GENERATE'
          ? `Đã đặt lại mật khẩu cho ${employee.fullName}. Hãy chuyển mật khẩu dưới đây cho nhân viên — nó chỉ hiển thị MỘT LẦN.`
          : `Đã đặt lại mật khẩu cho ${employee.fullName}.`,
      fullName: employee.fullName,
      email: employee.user.email,
      generatedPassword: dto.mode === 'GENERATE' ? newPassword : undefined,
    };
  }

  /**
   * Sinh mật khẩu ngẫu nhiên thỏa mãn SecurityPolicy hiện hành.
   * Dùng crypto.randomInt (an toàn mật mã) + Fisher–Yates shuffle,
   * đảm bảo mỗi nhóm ký tự bắt buộc có mặt ít nhất 1 lần.
   */
  private generatePolicyPassword(policy: {
    passwordMinLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireDigit: boolean;
    requireSpecial: boolean;
  }): string {
    const length = Math.max(12, policy.passwordMinLength);
    const LOWER = 'abcdefghijklmnopqrstuvwxyz';
    const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const DIGIT = '0123456789';
    const SPECIAL = '!@#$%^&*()-_=+';
    const ALL = LOWER + UPPER + DIGIT + SPECIAL;
    const pick = (set: string) => set[randomInt(set.length)]!;

    // Mỗi nhóm bắt buộc đảm bảo có ít nhất 1 ký tự
    const chars: string[] = [];
    if (policy.requireLowercase) chars.push(pick(LOWER));
    if (policy.requireUppercase) chars.push(pick(UPPER));
    if (policy.requireDigit) chars.push(pick(DIGIT));
    if (policy.requireSpecial) chars.push(pick(SPECIAL));
    while (chars.length < length) chars.push(pick(ALL));

    // Fisher–Yates shuffle
    for (let i = chars.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [chars[i], chars[j]] = [chars[j]!, chars[i]!];
    }

    const password = chars.join('');
    // Tự kiểm tra chốt hạ — phòng cấu hình policy đặc biệt
    const errors = validatePasswordPolicy(password, policy);
    if (errors.length > 0) {
      throw new BadRequestException(
        `Không sinh được mật khẩu đạt chính sách: cần ${errors.join(', ')}.`,
      );
    }
    return password;
  }

  async update(
    id: string,
    dto: {
      fullName?: string;
      phone?: string;
      address?: string;
      avatarUrl?: string;
      dateOfBirth?: Date;
      nationalId?: string;
      gender?: string;
      departmentId?: string;
      positionId?: string;
      managerId?: string;
      status?: string;
    },
  ) {
    if (dto.status !== undefined && !EMPLOYMENT_STATUSES.includes(dto.status)) {
      throw new BadRequestException(
        `Trạng thái không hợp lệ — cho phép: ${EMPLOYMENT_STATUSES.join(', ')}`,
      );
    }
    if (
      dto.gender !== undefined &&
      dto.gender !== null &&
      !GENDERS.includes(dto.gender)
    ) {
      throw new BadRequestException(
        `Giới tính không hợp lệ — cho phép: ${GENDERS.join(', ')}`,
      );
    }

    // Chỉ gán field được truyền rõ ràng (undefined bị Prisma bỏ qua tự nhiên)
    const data: {
      fullName?: string;
      phone?: string;
      address?: string;
      avatarUrl?: string;
      dateOfBirth?: Date;
      nationalId?: string;
      gender?: string;
      departmentId?: string;
      positionId?: string;
      managerId?: string;
      status?: string;
    } = {};
    for (const [key, value] of Object.entries(dto)) {
      if (value !== undefined) {
        data[key as keyof typeof data] = value as never;
      }
    }
    if (Object.keys(data).length === 0) {
      throw new BadRequestException('Không có trường nào để cập nhật');
    }

    return this.prisma.$transaction(async (tx) => {
      const employee = await tx.employee.update({
        where: { id },
        data: { ...data, status: data.status as any, gender: data.gender as any },
      });

      // Nghỉ việc phải cắt quyền truy cập ngay: tắt tài khoản, thu hồi phiên,
      // đóng hợp đồng. Trước đây chỉ đổi status nên nhân viên đã nghỉ vẫn đăng nhập được.
      if (data.status === 'TERMINATED') {
        await tx.user.update({
          where: { id: employee.userId },
          data: { isActive: false },
        });
        await tx.refreshToken.deleteMany({ where: { userId: employee.userId } });
        await tx.contract.updateMany({
          where: { employeeId: id, isActive: true },
          data: { isActive: false, endDate: new Date() },
        });
      } else if (
        data.status === 'ACTIVE' ||
        data.status === 'PROBATION' ||
        data.status === 'ON_LEAVE'
      ) {
        // Quay lại làm việc → mở lại tài khoản (nếu trước đó bị tắt do nghỉ việc)
        await tx.user.update({
          where: { id: employee.userId },
          data: { isActive: true },
        });
      }

      return employee;
    });
  }

  private async generateCode(): Promise<string> {
    // Lấy mã lớn nhất thay vì count()+1: xóa 1 nhân viên không làm tái sử dụng mã cũ,
    // và không đụng unique constraint khi có khoảng trống.
    const last = await this.prisma.employee.findFirst({
      where: { employeeCode: { startsWith: 'EMP' } },
      orderBy: { employeeCode: 'desc' },
      select: { employeeCode: true },
    });
    const lastNumber = last
      ? Number(last.employeeCode.replace(/[^0-9]/g, '')) || 0
      : 0;
    return `EMP${String(lastNumber + 1).padStart(4, '0')}`;
  }

  /** User placeholder inactive cho nhân viên mới chưa có tài khoản
   *  (Employee.userId NOT NULL). Email/password ngẫu nhiên → không thể đăng nhập. */
  private async createPlaceholderUser(employeeEmail: string): Promise<string> {
    const randomPassword = await bcrypt.hash(randomUUID(), 10);
    const placeholder = await this.prisma.user.create({
      data: {
        // Đặt theo email nhân viên + hậu tố random để không bao giờ trùng unique
        email: `${employeeEmail}.placeholder.${randomUUID().slice(0, 8)}`,
        passwordHash: randomPassword,
        role: 'EMPLOYEE',
        isActive: false,
      },
      select: { id: true },
    });
    return placeholder.id;
  }

  /** Tạo User active thật sự — email chính là whitelist OAuth login */
  private async createActiveUser(email: string, role: string): Promise<string> {
    const randomPassword = await bcrypt.hash(randomUUID(), 10);
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash: randomPassword,
        role: role as any,
        isActive: true,
      },
      select: { id: true },
    });
    return user.id;
  }

  private async assignOnboardingTasks(employeeId: string) {
    const tasks = await this.prisma.onboardingTask.findMany({
      orderBy: { order: 'asc' },
    });
    if (tasks.length === 0) return;

    await this.prisma.onboardingProgress.createMany({
      data: tasks.map((t) => ({
        employeeId,
        taskId: t.id,
        status: 'PENDING',
      })),
      skipDuplicates: true,
    });
  }
}
