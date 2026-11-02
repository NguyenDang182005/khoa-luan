import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '@repo/shared-types';
import { requireSecret } from '../require-secret';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: requireSecret(configService, 'JWT_SECRET'),
    });
  }

  /**
   * Chạy ở MỌI request có JWT:
   * 1. Token phải gắn sid (phiên) — nếu phiên đã bị thu hồi/hết hạn → 401 ngay
   *    (đây là cơ chế để nút "Thu hồi phiên" trong trang Cài Đặt có hiệu lực thật).
   * 2. User phải còn isActive — vô hiệu hóa tài khoản có hiệu lực tức thì.
   * Token cũ không có sid (phát hành trước bản nâng cấp) vẫn chấp nhận đến khi hết hạn.
   */
  async validate(payload: JwtPayload) {
    if (!payload.sub) throw new UnauthorizedException();

    if (payload.sid) {
      const session = await this.prisma.refreshToken.findUnique({
        where: { id: payload.sid },
        select: { expiresAt: true },
      });
      if (!session || session.expiresAt <= new Date()) {
        throw new UnauthorizedException('Phiên đăng nhập đã bị thu hồi hoặc hết hạn');
      }
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { isActive: true, role: true },
    });
    if (!user?.isActive) throw new UnauthorizedException('Tài khoản đã bị vô hiệu hóa');

    // Trả role hiện tại trong DB (không tin role trong token): hạ quyền ADMIN có hiệu lực
    // ngay ở request kế tiếp thay vì chờ token hết hạn (tới 30 ngày).
    return { ...payload, role: user.role };
  }
}
