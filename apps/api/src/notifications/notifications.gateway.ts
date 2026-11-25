import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { SkipThrottle } from '@nestjs/throttler';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { requireSecret } from '../auth/require-secret';
import { JwtPayload } from '@repo/shared-types';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async createAndSend(
    gateway: NotificationsGateway,
    userId: string,
    dto: {
      type: string;
      title: string;
      body: string;
      data?: object;
    },
  ) {
    const notification = await this.prisma.notification.create({
      data: {
        userId,
        type: dto.type as any,
        title: dto.title,
        body: dto.body,
        data: dto.data ?? undefined,
      },
    });

    // Push via WebSocket to the specific user's room
    gateway.server.to(`user:${userId}`).emit('notification:new', notification);
    return notification;
  }

  findByUser(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  /** Đánh dấu đã đọc — chỉ được đánh dấu thông báo của chính mình. */
  async markAsRead(id: string, userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true, readAt: new Date() },
    });
    if (result.count === 0) {
      throw new NotFoundException('Không tìm thấy thông báo');
    }
    return { updated: result.count };
  }

  markAllRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }
}

// Gateway nhận sự kiện qua WebSocket, không phải HTTP → bỏ qua ThrottlerGuard toàn cục
@SkipThrottle()
@WebSocketGateway({
  cors: {
    origin: process.env.WEB_URL?.split(',').map((s) => s.trim()) ?? ['http://localhost:3000'],
    credentials: true,
  },
  namespace: '/notifications',
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
    private readonly jwtStrategy: JwtStrategy,
  ) {}

  /** Verify chữ ký JWT rồi kiểm tra như HTTP: phiên (sid) chưa bị thu hồi, user còn active,
   *  role đọc lại từ DB — tránh admin đã bị thu hồi/hạ quyền vẫn nhận sự kiện. */
  private async verifyToken(token?: string) {
    if (!token) throw new UnauthorizedException('Thiếu token');
    const payload = this.jwt.verify<JwtPayload>(token, {
      secret: requireSecret(this.config, 'JWT_SECRET'),
    });
    return this.jwtStrategy.validate(payload);
  }

  /**
   * #14: verify JWT ở handshake. Trước đây bất kỳ ai cũng mở được socket và join
   * room 'admin' → xem được thống kê AI của công ty.
   */
  async handleConnection(client: Socket) {
    try {
      const token: string | undefined =
        client.handshake.auth?.token ?? client.handshake.headers?.authorization?.replace(/^Bearer /, '');
      const payload = await this.verifyToken(token);
      client.data.user = { sub: payload.sub, role: payload.role };
      client.join(`user:${payload.sub}`);
      if (payload.role === 'ADMIN') {
        client.join('admin');
      }
      console.log(`WS client connected: ${client.id} (${payload.email})`);
    } catch {
      console.warn(`WS client rejected (token không hợp lệ): ${client.id}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    console.log(`WS client disconnected: ${client.id}`);
  }

  /** Client (Admin/HR) joins the shared admin room after login */
  @SubscribeMessage('join-admin')
  handleJoinAdmin(@ConnectedSocket() client: Socket) {
    if (client.data.user?.role !== 'ADMIN') {
      return { status: 'forbidden' };
    }
    client.join('admin');
    return { status: 'joined', room: 'admin' };
  }

  /** Broadcast AI activity update to all admin-room clients.
   *  Called by AiContextService.saveMessage() after persisting to DB. */
  emitAiActivity(data: {
    wf: string;
    label: string;
    total: number;
    avgLatencyMs: number | null;
    lastActiveAt: string;
  }) {
    this.server.to('admin').emit('ai:activity', data);
  }
}
