import { Injectable, UnauthorizedException, Optional, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CanActivate, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { timingSafeEqual } from 'crypto';
import { NotificationsGateway } from '../notifications/notifications.gateway';

import { LeaveService } from '../leave/leave.service';

/** Guard: validates x-api-key header — used for n8n internal calls */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const key = req.headers['x-api-key'];
    const expected = this.config.get<string>('N8N_API_KEY');
    // So sánh hằng thời gian — tránh dò khóa qua thời gian phản hồi.
    const a = Buffer.from(typeof key === 'string' ? key : '');
    const b = Buffer.from(expected ?? '');
    if (!expected || a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException('Invalid API Key');
    }
    return true;
  }
}

@Injectable()
export class AiContextService {
  private readonly logger = new Logger(AiContextService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    @Optional() private gateway: NotificationsGateway,
    private leaveService: LeaveService,
  ) {}

  /** Returns full employee context for n8n to inject into LLM prompt.
   *  employeeId param có thể là UUID hoặc employeeCode (VD: "EMP003") */
  async getEmployeeContext(employeeId: string) {
    // Tìm theo employeeCode trước (n8n gửi code), fallback sang UUID
    const isCode = /^EMP\d+$/i.test(employeeId);
    const employee = await this.prisma.employee.findFirstOrThrow({
      where: isCode ? { employeeCode: employeeId } : { id: employeeId },
      include: {
        department: { select: { name: true, code: true } },
        position: { select: { title: true, level: true } },
        manager: { select: { fullName: true, email: true } },
        contracts: {
          where: { isActive: true },
          select: {
            type: true,
            baseSalary: true,
            allowances: true,
            startDate: true,
            endDate: true,
          },
          take: 1,
        },
      },
    });

    const activeContract = employee.contracts[0];

    // Tính số ngày phép bằng đúng LeaveService (quota + pro-rate + ngày lễ) —
    // trước đây còn nhánh fallback đọc allowances.annualLeaveDays trong khi
    // allowances là Float nên luôn undefined (dead code).
    const currentYear = new Date().getFullYear();
    const balance = await this.leaveService.getBalance(
      employee.id,
      currentYear,
    );

    return {
      employeeId: employee.id,
      employeeCode: employee.employeeCode,
      fullName: employee.fullName,
      joinDate: employee.joinDate,
      status: employee.status,
      gender: employee.gender,
      department: employee.department.name,
      position: employee.position.title,
      positionLevel: employee.position.level,
      manager: employee.manager?.fullName ?? null,
      contract: activeContract ?? null,
      leaveBalance: {
        annual: {
          total: balance.total,
          used: balance.used,
          remaining: balance.remaining,
          quota: balance.quota,
        },
      },
    };
  }

  async getPayrollContext(employeeId: string, month: number, year: number) {
    // Resolve employeeCode → UUID nếu cần
    const isCode = /^EMP\d+$/i.test(employeeId);
    let resolvedId = employeeId;
    if (isCode) {
      const emp = await this.prisma.employee.findFirst({
        where: { employeeCode: employeeId },
        select: { id: true },
      });
      if (!emp) return { message: `Không tìm thấy nhân viên ${employeeId}` };
      resolvedId = emp.id;
    }

    const payroll = await this.prisma.payroll.findUnique({
      where: { employeeId_month_year: { employeeId: resolvedId, month, year } },
    });
    return payroll ?? { message: `Chưa có dữ liệu lương tháng ${month}/${year}` };
  }

  // ── Chat session management ──────────────────────────────────────────────

  /** Ngày (YYYY-MM-DD) theo múi giờ VN — phục vụ quy tắc phiên theo ngày (Q7) */
  private vnDate(d: Date): string {
    return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
  }

  async createOrGetSession(dto: {
    sessionId?: string;
    employeeId?: string;
    type: string;
    channel: string;
    externalId?: string;
  }) {
    // type phải thuộc enum ChatSessionType (HR_QA|CSKH|TRAINING) — giá trị khác
    // (vd OTHER từ client cũ) chuẩn hóa về HR_QA để tránh Prisma lỗi enum.
    const dto2 = {
      ...dto,
      type: (['HR_QA', 'CSKH', 'TRAINING'] as string[]).includes(dto.type) ? dto.type : 'HR_QA',
    };
    dto = dto2;

    // Resolve employeeCode (EMP003) → UUID nếu cần (chạy TRƯỚC để kiểm tra sở hữu phiên)
    let resolvedEmployeeId: string | null = dto.employeeId ?? null;
    if (resolvedEmployeeId && /^EMP\d+$/i.test(resolvedEmployeeId)) {
      const emp = await this.prisma.employee.findFirst({
        where: { employeeCode: resolvedEmployeeId },
        select: { id: true },
      });
      resolvedEmployeeId = emp?.id ?? null;
    }

    // Q16-session: portal chỉ định sẵn sessionId (backend sở hữu phiên) —
    // dùng thẳng nếu còn active, đúng chủ sở hữu VÀ cùng ngày (VN), không thì
    // rơi xuống logic get-or-create bên dưới để đóng phiên cũ + mở phiên mới (Q7-day).
    if (dto.sessionId) {
      const explicit = await this.prisma.aiChatSession.findFirst({
        where: {
          id: dto.sessionId,
          isActive: true,
          // Q18: phiên phải thuộc đúng employee — chống dùng chéo sessionId
          ...(resolvedEmployeeId ? { employeeId: resolvedEmployeeId } : {}),
        },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
      });
      if (explicit && this.vnDate(explicit.updatedAt) === this.vnDate(new Date())) {
        return explicit;
      }
    }

    // Q7: Tìm session gần nhất của người dùng.
    // Ưu tiên match đúng (employee + type + channel) khi có employeeId để tránh
    // nhặt nhầm session loại khác qua externalId; chỉ dùng externalId cho kênh
    // ngoài (Zalo/Slack) không có employeeId nội bộ.
    const lookupId = dto.externalId || resolvedEmployeeId;
    if (lookupId) {
      const existing = await this.prisma.aiChatSession.findFirst({
        where: resolvedEmployeeId
          ? {
              employeeId: resolvedEmployeeId,
              type: dto.type as any,
              channel: dto.channel,
            }
          : { externalId: dto.externalId ?? '' },
        orderBy: { createdAt: 'desc' },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
      });

      if (existing) {
        // Kiểm tra xem session có cùng ngày hôm nay (múi giờ VN) hay không
        const isSameDay = this.vnDate(existing.updatedAt) === this.vnDate(new Date());

        if (isSameDay) {
          // Vẫn trong cùng ngày (chưa qua 12h đêm):
          // Giữ nguyên phiên hiện tại (nếu đang isActive=false do escalate thì bot vẫn tắt)
          return existing;
        }

        // Đã qua 12h đêm (sang ngày mới):
        // Đóng hẳn session cũ nếu còn active để lưu trữ
        if (existing.isActive) {
          await this.prisma.aiChatSession.update({
            where: { id: existing.id },
            data: { isActive: false },
          });
        }
        // Xuống dưới tạo session mới toanh cho ngày mới (mặc định isActive: true)
      }
    }

    return this.prisma.aiChatSession.create({
      data: {
        employeeId: resolvedEmployeeId,
        type: dto.type as any,
        channel: dto.channel,
        externalId: dto.externalId ?? resolvedEmployeeId,
        isActive: true,
      },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
  }

  /** Q16-session: phiên chat web gần nhất của nhân viên theo loại.
   *  type phải thuộc enum ChatSessionType (HR_QA|CSKH|TRAINING) — giá trị khác
   *  (vd OTHER từ client cũ) chuẩn hóa về HR_QA để tránh Prisma lỗi enum. */
  async getLatestWebSession(employeeId: string, type: string) {
    const normalizedType = (['HR_QA', 'CSKH', 'TRAINING'] as string[]).includes(type) ? type : 'HR_QA';
    return this.prisma.aiChatSession.findFirst({
      where: { employeeId, type: normalizedType as any, channel: 'web' },
      orderBy: { updatedAt: 'desc' },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
  }

  /** Q16 + Q7-day: phiên web CHỈ ĐỜI REHYDRATE — còn active và cùng ngày (VN).
   *  Khác ngày → trả null để portal không kéo đoạn chat cũ của hôm trước vào UI;
  *   lượt chat mới sau đó sẽ tự rollover sang phiên mới qua createOrGetSession. */
  async getRehydratableWebSession(employeeId: string, type: string) {
    const latest = await this.getLatestWebSession(employeeId, type);
    if (!latest || !latest.isActive) return null;
    if (this.vnDate(latest.updatedAt) !== this.vnDate(new Date())) return null;
    return latest;
  }

  /** Q19(i1) — "Phiên mới": đóng phiên web hiện tại và mở phiên mới cùng loại */
  async renewWebSession(employeeId: string, type: string) {
    const normalizedType = (['HR_QA', 'CSKH', 'TRAINING'] as string[]).includes(type) ? type : 'HR_QA';
    const latest = await this.getLatestWebSession(employeeId, normalizedType);
    if (latest?.isActive) {
      await this.prisma.aiChatSession.update({
        where: { id: latest.id },
        data: { isActive: false },
      });
    }
    return this.prisma.aiChatSession.create({
      data: {
        employeeId,
        type: normalizedType as any,
        channel: 'web',
        externalId: employeeId,
        isActive: true,
      },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
  }

  async getEscalationQueue() {
    const sessions = await this.prisma.aiChatSession.findMany({
      // Chỉ phiên THỰC SỰ bị escalate (có escalatedAt). Phiên bị đóng do qua ngày
      // cũng isActive=false nhưng không có escalatedAt → không chen vào hàng đợi.
      where: {
        type: 'CSKH',
        isActive: false,
        channel: 'zalo',
        escalatedAt: { not: null },
      },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        employee: { select: { fullName: true, employeeCode: true } },
      },
      orderBy: { escalatedAt: 'desc' },
    });
    return sessions.map(s => ({
      id: s.id,
      externalId: s.externalId,
      lastMessage: s.messages[0]?.content ?? '',
      lastMessageAt: s.messages[0]?.createdAt ?? s.updatedAt,
      messageCount: s.messages.length,
      metadata: s.messages[0]?.metadata,
    }));
  }

  async saveMessage(dto: {
    sessionId: string;
    role: string;
    content: string;
    metadata?: object;
  }) {
    // 1. Persist message
    const message = await this.prisma.aiChatMessage.create({
      data: {
        sessionId: dto.sessionId,
        role: dto.role,
        content: dto.content,
        metadata: dto.metadata ?? undefined,
      },
      include: { session: { select: { type: true } } },
    });

    // 2. Emit WS update only for assistant messages (what the panel tracks)
    if (dto.role === 'assistant' && this.gateway) {
      const type = message.session.type as string;
      const wfMap: Record<string, { wf: string; label: string }> = {
        HR_QA:    { wf: 'WF02', label: 'HR Q&A' },
        TRAINING: { wf: 'WF03', label: 'Training' },
        CSKH:     { wf: 'WF04', label: 'CSKH Zalo' },
      };
      const wfInfo = wfMap[type];
      if (wfInfo) {
        // Aggregate bounded (7 ngày gần nhất, tối đa 500 tin) — trước đây mỗi tin nhắn
        // lại quét toàn bộ lịch sử nên càng chat càng chậm (O(n²)).
        const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const messages = await this.prisma.aiChatMessage.findMany({
          where: {
            role: 'assistant',
            session: { type: type as any },
            createdAt: { gte: since },
          },
          select: { metadata: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 500,
        });
        const latencies = messages
          .map(m => (m.metadata as any)?.latency_ms as number | null)
          .filter((v): v is number => typeof v === 'number' && v > 0);
        const avgLatencyMs = latencies.length
          ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
          : null;

        this.gateway.emitAiActivity({
          ...wfInfo,
          total: messages.length,
          avgLatencyMs,
          lastActiveAt: message.createdAt.toISOString(),
        });
      }
    }

    return message;
  }

  getSessionHistory(sessionId: string) {
    return this.prisma.aiChatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
    });
  }

  // ── Escalation & Bot Reactivation (Human-in-the-loop) ─────────────────────

  /** Q2: n8n gọi khi CSKH Agent phát hiện khiếu nại vượt thẩm quyền.
   *  Tắt bot (isActive = false) cho session này, lưu notification và
   *  emit WebSocket để Web Portal hiển thị cảnh báo real-time cho Admin. */
  async escalateToHuman(dto: {
    sessionId: string;
    userId: string;
    channel: string;
    lastMessage: string;
    reason: string;
  }) {
    // 1. Tắt bot + đánh dấu thời điểm escalate (dashboard/hàng đợi dựa vào cột này)
    if (dto.sessionId) {
      await this.prisma.aiChatSession
        .update({
          where: { id: dto.sessionId },
          data: { isActive: false, escalatedAt: new Date() },
        })
        .catch(() => null);
    }

    // 2. Tạo notification cảnh báo cho TỪNG user thuộc nhóm Admin.
    //    Trước đây dùng sentinel userId 'admin-broadcast' → user không tồn tại
    //    → FK violation P2003 (Notification.userId reference users.id).
    const admins = await this.prisma.user.findMany({
      where: { role: { in: ['ADMIN'] }, isActive: true },
      select: { id: true },
    });

    const notificationIds: string[] = [];
    for (const admin of admins) {
      // Tạo riêng cho từng admin — một notification fail không làm hỏng các admin còn lại
      const notification = await this.prisma.notification
        .create({
          data: {
            userId: admin.id,
            type: 'SYSTEM' as any,
            title: '🚨 Khiếu nại cần xử lý thủ công',
            body: `Kênh: ${dto.channel} | User: ${dto.userId} | ${dto.reason}`,
            data: {
              sessionId: dto.sessionId,
              userId: dto.userId,
              channel: dto.channel,
              lastMessage: dto.lastMessage,
              escalatedAt: new Date().toISOString(),
            },
          },
        })
        .catch(() => null);
      if (!notification) continue;
      notificationIds.push(notification.id);

      // Đẩy realtime tới đúng admin (và room admin cho màn hình tổng hợp).
      // Trước đây chỉ ghi DB nên portal phải refresh mới thấy escalation.
      this.gateway?.server
        ?.to(`user:${admin.id}`)
        .to('admin')
        .emit('notification:new', notification);
    }

    return { notified: notificationIds.length, notificationIds };
  }

  /** Cho phép Admin chủ động bật lại Bot ngay trên Web Portal mà không cần chờ qua 12h đêm */
  async reactivateSession(sessionId: string) {
    return this.prisma.aiChatSession.update({
      where: { id: sessionId },
      data: { isActive: true, escalatedAt: null },
    });
  }

  async deactivateSession(sessionId: string) {
    return this.prisma.aiChatSession.update({
      where: { id: sessionId },
      data: { isActive: false },
    });
  }

  /** GET /agents/conversations — TOÀN BỘ hội thoại CSKH (đang bot + đã escalate). */
  async getConversations() {
    const sessions = await this.prisma.aiChatSession.findMany({
      where: { type: 'CSKH', channel: 'zalo' },
      include: {
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        _count: { select: { messages: true } },
        employee: { select: { fullName: true, employeeCode: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
    return sessions.map((s) => ({
      id: s.id,
      externalId: s.externalId,
      escalated: s.escalatedAt !== null,
      lastMessage: s.messages[0]?.content ?? '',
      lastMessageAt: s.messages[0]?.createdAt ?? s.updatedAt,
      messageCount: s._count.messages,
      metadata: s.messages[0]?.metadata,
    }));
  }

  /** Gửi tin nhắn vào Slack channel (transport demo của kênh Zalo) — channel + thread reply.
   *  channel: Slack channel ID (C...), threadTs: ts của message gốc để reply trong thread. */
  async sendSlackChannelMessage(
    channel: string,
    content: string,
    threadTs?: string,
  ) {
    const token = this.config.get<string>('SLACK_BOT_TOKEN');
    if (!token) return { delivered: false, reason: 'SLACK_BOT_TOKEN_NOT_CONFIGURED' };
    try {
      const body: Record<string, unknown> = {
        channel,
        text: content,
        // Đánh dấu bot để Bolt listener bỏ qua tin của chính bot (tránh loop)
        metadata: {
          event_type: 'hr_agent_reply',
          event_payload: { source: 'nests-wf04' },
        },
      };
      if (threadTs) {
        body.thread_ts = threadTs;
        body.reply_broadcast = true; // Hiện cả trong Thread lẫn phát sóng ra kênh chính #demo
      }

      const res = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { ok: boolean; error?: string; ts?: string };
      if (data.ok) {
        this.logger.log(`[Slack outbound] ✅ Đã gửi phản hồi tới channel ${channel} (thread: ${threadTs ?? 'root'})`);
      } else {
        this.logger.error(`[Slack outbound] ❌ Gửi thất bại: ${data.error}`);
      }
      return data.ok
        ? { delivered: true, ts: data.ts }
        : { delivered: false, reason: `SLACK_POST_FAILED:${data.error ?? 'unknown'}` };
    } catch (e) {
      this.logger.error(`[Slack outbound] Lỗi kết nối: ${(e as Error).message}`);
      return { delivered: false, reason: `SLACK_NETWORK_ERROR:${(e as Error).message}` };
    }
  }

  /** Legacy: Gửi Slack DM (giữ cho backward-compat, fallback khi không có slackChannel). */
  async sendSlackDm(externalId: string, content: string) {
    const token = this.config.get<string>('SLACK_BOT_TOKEN');
    if (!token) return { delivered: false, reason: 'SLACK_BOT_TOKEN_NOT_CONFIGURED' };
    if (!externalId || !/^U[A-Z0-9]+$/i.test(externalId)) {
      return { delivered: false, reason: 'NOT_A_SLACK_USER' };
    }
    try {
      const openRes = await fetch('https://slack.com/api/conversations.open', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ users: externalId }),
      });
      const open = (await openRes.json()) as {
        ok: boolean;
        channel?: { id: string };
        error?: string;
      };
      if (!open.ok || !open.channel?.id) {
        return { delivered: false, reason: `SLACK_OPEN_DM_FAILED:${open.error ?? 'unknown'}` };
      }
      return this.sendSlackChannelMessage(open.channel.id, content);
    } catch (e) {
      return { delivered: false, reason: `SLACK_NETWORK_ERROR:${(e as Error).message}` };
    }
  }

  /** POST /n8n/outbound-reply — n8n WF04 gọi sau khi AI soạn xong câu trả lời.
   *  Ưu tiên channel mode (slackChannel + threadTs); fallback sang DM nếu không có. */
  async deliverOutboundReply(dto: {
    sessionId?: string;
    externalId?: string;
    slackChannel?: string;
    threadTs?: string;
    content: string;
  }) {
    // Channel mode (socket mode / channel transport)
    if (dto.slackChannel) {
      return this.sendSlackChannelMessage(dto.slackChannel, dto.content, dto.threadTs);
    }

    // Fallback: DM mode (legacy)
    let externalId = dto.externalId ?? null;
    if (!externalId && dto.sessionId) {
      const session = await this.prisma.aiChatSession.findUnique({
        where: { id: dto.sessionId },
        select: { externalId: true },
      });
      externalId = session?.externalId ?? null;
    }
    if (!externalId) return { delivered: false, reason: 'NO_EXTERNAL_ID' };
    return this.sendSlackDm(externalId, dto.content);
  }

  /** Cron: 00:00 Asia/Ho_Chi_Minh mỗi ngày — bật lại tất cả CSKH session bị escalate,
   *  gửi greeting vào channel để báo AI đã sẵn sàng. */
  @Cron('0 0 * * *', { timeZone: 'Asia/Ho_Chi_Minh' })
  async midnightResetEscalatedSessions() {
    const { count } = await this.prisma.aiChatSession.updateMany({
      // Chỉ phiên bị leo thang — phiên đóng do sang ngày mới giữ nguyên.
      where: { type: 'CSKH', isActive: false, escalatedAt: { not: null } },
      // Mở lại bot cho ngày mới; xóa dấu escalate để hàng đợi không giữ phiên cũ.
      data: { isActive: true, escalatedAt: null },
    });

    if (count > 0) {
      this.logger.log(`[Cron midnight] Đã bật lại ${count} CSKH session bị escalate`);
    }

    // Gửi greeting vào channel (nếu cấu hình SLACK_CHANNEL_ID)
    const channelId = this.config.get<string>('SLACK_CHANNEL_ID');
    if (channelId) {
      await this.sendSlackChannelMessage(
        channelId,
        '👋 Trợ lý AI CSKH đã sẵn sàng hỗ trợ bạn từ hôm nay!',
      );
    }
  }
}

