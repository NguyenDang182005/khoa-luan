import { Injectable, UnauthorizedException, ForbiddenException, Logger } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";
import { LoginRequest, JwtPayload } from "@repo/shared-types";
import { FirebaseAdminService } from "../firebase/firebase-admin.service";

interface FirebaseLoginRequest {
  idToken: string;
  rememberMe?: boolean;
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

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { employee: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException("Email hoặc mật khẩu không đúng");
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException(
        "Tài khoản này chỉ đăng nhập được bằng Google / Facebook",
      );
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException("Email hoặc mật khẩu không đúng");
    }

    return user;
  }

  async login(dto: LoginRequest) {
    const user = await this.validateUser(dto.email, dto.password);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role as any,
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>("JWT_REFRESH_SECRET", "hr-refresh-secret"),
      expiresIn: "30d",
    });

    await this.prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

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

  async loginWithFirebase(dto: FirebaseLoginRequest) {
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
      throw new ForbiddenException(
        "Tài khoản chưa được cấp quyền truy cập. Liên hệ HR Admin để được hỗ trợ.",
      );
    }

    // Link Firebase UID on first OAuth login
    const updates: Record<string, any> = { lastLoginAt: new Date() };
    if (!(user as any).firebaseUid) updates.firebaseUid = uid;
    if (isGoogle && !(user as any).googleId) updates.googleId = uid;
    if (isFacebook && !(user as any).facebookId) updates.facebookId = uid;
    if (picture && !(user as any).avatarUrl) updates.avatarUrl = picture;
    if (name && !(user as any).displayName) updates.displayName = name;

    await this.prisma.user.update({ where: { id: user.id }, data: updates });

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role as any,
      firebaseUid: uid,
    };

    const expiresIn = "30d";
    const accessToken = this.jwtService.sign(payload, { expiresIn });
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>("JWT_REFRESH_SECRET", "hr-refresh-secret"),
      expiresIn: "30d",
    });

    await this.prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

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

  async logout(userId: string, refreshToken: string) {
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
