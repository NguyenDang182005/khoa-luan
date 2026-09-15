import { Injectable } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';

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

  markAsRead(id: string) {
    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    });
  }

  markAllRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }
}

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/notifications',
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  handleConnection(client: Socket) {
    console.log(`WS client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`WS client disconnected: ${client.id}`);
  }

  /** Client (Admin/HR) joins the shared admin room after login */
  @SubscribeMessage('join-admin')
  handleJoinAdmin(@ConnectedSocket() client: Socket) {
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
