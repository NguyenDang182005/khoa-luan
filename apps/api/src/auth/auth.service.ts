import { Injectable, UnauthorizedException, ForbiddenException, BadRequestException, NotFoundException, Logger } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";
import { LoginRequest, JwtPayload } from "@repo/shared-types";
import { FirebaseAdminService } from "../firebase/firebase-admin.service";
import { ensureDefaultSecurityPolicy } from "../settings/single-row.utils";
import { validatePasswordPolicy } from "./password-policy";
import { requireSecret } from "./require-secret";

// Re-export giữ tương thích với chỗ import cũ
export { validatePasswordPolicy } from "./password-policy";

interface FirebaseLoginRequest {
  idToken: string;
  rememberMe?: boolean;
}

/** Ngữ cảnh request phục vụ audit phiên: IP + trình duyệt */
export interface LoginMeta {
  ip?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private firebaseAdmin: FirebaseAdminService,
  ) {}

  /** Ghi lịch sử đăng nhập — lỗi ghi log không được chặn đăng nhập */
  private async recordLogin(
    userId: string | undefined,
    email: string,
    success: boolean,
    reason: string | null,
    meta: LoginMeta,
  ) {
    try {
      await this.prisma.loginHistory.create({
        data: {
          userId: userId ?? null,
          email,
          success,
          reason,
          ip: meta.ip ?? null,
          userAgent: meta.userAgent ? meta.userAgent.slice(0, 255) : null,
        },
      });
    } catch (e) {
      this.logger.warn(`Không ghi được login history: ${(e as Error).message}`);
    }
  }

  /** Tạo phiên đăng nhập: refresh token row (kèm IP/UA) → access token gắn sid + TTL theo SecurityPolicy */
  private async createSession(payload: JwtPayload, meta: LoginMeta) {
    const policy = await ensureDefaultSecurityPolicy(this.prisma);

    const refreshToken = this.jwtService.sign(payload, {
      secret: requireSecret(this.configService, 'JWT_REFRESH_SECRET'),
      expiresIn: "30d",
    });
    const session = await this.prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: payload.sub,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        ip: meta.ip ?? null,
        userAgent: meta.userAgent ? meta.userAgent.slice(0, 255) : null,
      },
    });

    const accessToken = this.jwtService.sign(
      { ...payload, sid: session.id },
      { expiresIn: `${policy.accessTokenTtlHours}h` },
    );

    return { accessToken, refreshToken };
  }

  async login(dto: LoginRequest, meta: LoginMeta = {}) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { employee: true },
    });

    const fail = async (
      reason: string,
      message: string,
      userId?: string,
    ): Promise<never> => {
      await this.recordLogin(userId, dto.email, false, reason, meta);
      throw new UnauthorizedException(message);
    };

    if (!user || !user.isActive) {
      return fail(
        !user ? "USER_NOT_FOUND" : "ACCOUNT_DISABLED",
        "Email hoặc mật khẩu không đúng",
        user?.id,
      );
    }

    // Khóa tài khoản sau N lần sai liên tiếp (SecurityPolicy)
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const mins = Math.max(1, Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000));
      await this.recordLogin(user.id, user.email, false, "ACCOUNT_LOCKED", meta);
      throw new UnauthorizedException(
        `Tài khoản tạm khóa do nhập sai mật khẩu nhiều lần. Thử lại sau khoảng ${mins} phút.`,
      );
    }

    if (!user.passwordHash) {
      return fail(
        "OAUTH_ONLY",
        "Tài khoản này chỉ đăng nhập được bằng Google / Facebook",
        user.id,
      );
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      const policy = await ensureDefaultSecurityPolicy(this.prisma);
      const attempts = user.failedLoginAttempts + 1;
      const shouldLock = attempts >= policy.maxFailedAttempts;

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          // Khi kích hoạt khóa thì reset bộ đếm (mở khóa xong đếm lại từ 0)
          failedLoginAttempts: shouldLock ? 0 : attempts,
          lockedUntil: shouldLock
            ? new Date(Date.now() + policy.lockoutMinutes * 60_000)
            : user.lockedUntil,
        },
      });

      if (shouldLock) {
        await this.recordLogin(user.id, user.email, false, "ACCOUNT_LOCKED", meta);
        throw new UnauthorizedException(
          `Bạn đã nhập sai mật khẩu ${policy.maxFailedAttempts} lần liên tiếp. Tài khoản tạm khóa ${policy.lockoutMinutes} phút.`,
        );
      }
      return fail("INVALID_PASSWORD", "Email hoặc mật khẩu không đúng", user.id);
    }

    // Đăng nhập thành công — reset bộ đếm khóa
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), failedLoginAttempts: 0, lockedUntil: null },
    });
    await this.recordLogin(user.id, user.email, true, null, meta);

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role as any,
    };

    const { accessToken, refreshToken } = await this.createSession(payload, meta);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt.toISOString(),
        avatarUrl: (user as any).avatarUrl ?? null,
        displayName: (user as any).displayName ?? null,
      },
    };
  }

  async loginWithFirebase(dto: FirebaseLoginRequest, meta: LoginMeta = {}) {
    let decoded: any;
    try {
      decoded = await this.firebaseAdmin.verifyIdToken(dto.idToken);
    } catch (err) {
      this.logger.error("Firebase token verification failed", err);
      throw new UnauthorizedException("Token Firebase không hợp lệ");
    }

    const { uid, email, name, picture, firebase } = decoded;
    const providerIds: string[] = (firebase?.identities
      ? Object.keys(firebase.identities)
      : []) as string[];
    const isGoogle = providerIds.includes("google.com");
    const isFacebook = providerIds.includes("facebook.com");

    if (!email) {
      throw new UnauthorizedException("Không lấy được email từ tài khoản Firebase");
    }

    // Whitelist check
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) {
      await this.recordLogin(user?.id, email, false, !user ? "USER_NOT_FOUND" : "ACCOUNT_DISABLED", meta);
      throw new ForbiddenException(
        "Tài khoản chưa được cấp quyền truy cập. Liên hệ HR Admin để được hỗ trợ.",
      );
    }

    // Chặn OAuth khi tài khoản đang bị khóa tạm
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await this.recordLogin(user.id, user.email, false, "ACCOUNT_LOCKED", meta);
      throw new ForbiddenException(
        "Tài khoản tạm khóa do nhập sai mật khẩu nhiều lần. Thử lại sau ít phút.",
      );
    }

    // Link Firebase UID on first OAuth login
    const updates: Record<string, any> = { lastLoginAt: new Date(), failedLoginAttempts: 0, lockedUntil: null };
    if (!(user as any).firebaseUid) updates.firebaseUid = uid;
    if (isGoogle && !(user as any).googleId) updates.googleId = uid;
    if (isFacebook && !(user as any).facebookId) updates.facebookId = uid;
    if (picture && !(user as any).avatarUrl) updates.avatarUrl = picture;
    if (name && !(user as any).displayName) updates.displayName = name;

    await this.prisma.user.update({ where: { id: user.id }, data: updates });
    await this.recordLogin(user.id, user.email, true, null, meta);

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role as any,
      firebaseUid: uid,
    };

    const { accessToken, refreshToken } = await this.createSession(payload, meta);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt.toISOString(),
        avatarUrl: updates.avatarUrl ?? (user as any).avatarUrl ?? picture ?? null,
        displayName: updates.displayName ?? (user as any).displayName ?? name ?? null,
      },
    };
  }

  /**
   * Đổi mật khẩu (JWT) — áp SecurityPolicy, cập nhật passwordChangedAt,
   * và thu hồi mọi phiên đăng nhập khác (giữ phiên hiện tại).
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    currentSessionId?: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException("Không tìm thấy người dùng");
    if (!user.passwordHash) {
      throw new BadRequestException(
        "Tài khoản này đăng nhập bằng Google/Facebook, không có mật khẩu cục bộ để đổi",
      );
    }

    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) throw new UnauthorizedException("Mật khẩu hiện tại không đúng");

    const policy = await ensureDefaultSecurityPolicy(this.prisma);
    const errors = validatePasswordPolicy(newPassword, policy);
    if (errors.length > 0) {
      throw new BadRequestException(
        `Mật khẩu mới chưa đạt yêu cầu: cần ${errors.join(", ")}.`,
      );
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, passwordChangedAt: new Date() },
    });

    // Mất mật khẩu ⇒ nghi ngờ phiên cũ — thu hồi mọi phiên khác
    const revoked = await this.prisma.refreshToken.deleteMany({
      where: { userId, ...(currentSessionId ? { id: { not: currentSessionId } } : {}) },
    });

    return {
      message: revoked.count
        ? `Đổi mật khẩu thành công. Đã đăng xuất ${revoked.count} phiên khác.`
        : "Đổi mật khẩu thành công.",
    };
  }

  async logout(userId: string, refreshToken: string | undefined) {
    if (!refreshToken) {
      // Fix bug cũ: Prisma bỏ qua filter undefined → xóa nhầm TOÀN BỘ refresh token của user
      throw new BadRequestException("Thiếu refreshToken trong yêu cầu đăng xuất");
    }
    await this.prisma.refreshToken.deleteMany({
      where: { userId, token: refreshToken },
    });
    return { message: "Đăng xuất thành công" };
  }

  async getProfile(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        avatarUrl: true,
        displayName: true,
        employee: {
          select: {
            id: true,
            employeeCode: true,
            fullName: true,
            avatarUrl: true,
            department: { select: { name: true } },
            position: { select: { title: true } },
          },
        },
      },
    });
  }
}
