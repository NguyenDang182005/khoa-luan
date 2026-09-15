import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AiContextService } from '../ai-context/ai-context.service';
import { OnboardingService } from '../onboarding/onboarding.service';

const N8N_CHAT_TIMEOUT_MS = 30_000;

@Injectable()
export class AgentsService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private aiContext: AiContextService,
    private onboarding: OnboardingService,
  ) {}

  async getPerformance() {
    // Map session type -> workflow ID
    const typeMap: Record<string, string> = { HR_QA: 'wf02', TRAINING: 'wf03', CSKH: 'wf04' };

    const sessions = await this.prisma.aiChatSession.findMany({
      include: {
        messages: {
          where: { role: 'assistant' },
          select: { metadata: true, createdAt: true },
        },
      },
    });

    const stats: Record<
      string,
      { latencies: number[]; callCount: number; failures: number; lastActivity: Date | null }
    > = {
      wf01: { latencies: [], callCount: 0, failures: 0, lastActivity: null },
      wf02: { latencies: [], callCount: 0, failures: 0, lastActivity: null },
      wf03: { latencies: [], callCount: 0, failures: 0, lastActivity: null },
      wf04: { latencies: [], callCount: 0, failures: 0, lastActivity: null },
    };

    for (const session of sessions) {
      const wfId = typeMap[session.type] ?? 'wf01';
      const stat = stats[wfId]!;
      for (const msg of session.messages) {
        const meta = msg.metadata as any;
        if (meta?.latency_ms && typeof meta.latency_ms === 'number') {
          stat.latencies.push(meta.latency_ms);
        }
        if (meta?.error === true) {
          stat.failures++;
        }
        stat.callCount++;
        if (!stat.lastActivity || msg.createdAt > stat.lastActivity) {
          stat.lastActivity = msg.createdAt;
        }
      }
    }

    const result: Record<string, any> = {};
    for (const [wfId, stat] of Object.entries(stats)) {
      const avg = stat.latencies.length > 0
        ? Math.round(stat.latencies.reduce((a, b) => a + b, 0) / stat.latencies.length)
        : null;
      const last = stat.latencies.length > 0 ? stat.latencies[stat.latencies.length - 1] : null;
      result[wfId] = {
        avgLatency: avg,
        lastLatency: last,
        callCount: stat.callCount,
        successRate:
          stat.callCount > 0
            ? Math.round(((stat.callCount - stat.failures) / stat.callCount) * 1000) / 10
            : null, // % tin nhắn KHÔNG lỗi (đếm metadata.error === true)
        lastActivity: stat.lastActivity,
      };
    }
    return result;
  }

  /** GET /agents/intent-stats — thống kê định tuyến của Router Agent (WF01):
   *  đếm metadata.intent trên các tin nhắn assistant đã lưu. */
  async getIntentStats() {
    const messages = await this.prisma.aiChatMessage.findMany({
      where: { role: 'assistant' },
      select: { metadata: true },
    });

    const byIntent: Record<string, number> = { HR_QA: 0, CSKH: 0, TRAINING: 0, OTHER: 0 };
    let total = 0;
    let escalations = 0;
    for (const m of messages) {
      const meta = m.metadata as { intent?: unknown; escalated?: unknown } | null;
      const intent = typeof meta?.intent === 'string' ? meta.intent : null;
      if (!intent) continue;
      total++;
      if (intent in byIntent) byIntent[intent] = (byIntent[intent] ?? 0) + 1;
      if (meta?.escalated === true) escalations++;
    }

    return { total, byIntent, escalations };
  }

  // ── Web Portal (JWT) — browser không gọi n8n trực tiếp nữa ───────────────

  /** Resolve Employee từ JWT payload (req.user.sub = userId) */
  private async resolveEmployee(userId: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { userId },
    });
    if (!employee) {
      throw new BadRequestException(
        'Người dùng không liên kết với hồ sơ nhân viên',
      );
    }
    return employee;
  }

  /** POST /agents/chat — gọi n8n WF01 server-side, đo latency round-trip.
   *  Env: N8N_WEBHOOK_URL (fallback http://localhost:5678/webhook/chat),
   *       N8N_API_KEY (header x-api-key, như n8n ↔ NestJS). */
  async portalChat(
    userId: string,
    message: string,
  ): Promise<{ answer: string; latencyMs: number }> {
    const employee = await this.resolveEmployee(userId);

    const webhookUrl =
      this.config.get<string>('N8N_WEBHOOK_URL') ??
      'http://localhost:5678/webhook/chat';
    const apiKey = this.config.get<string>('N8N_API_KEY');

    const startedAt = Date.now();
    let response: Response;
    try {
      response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { 'x-api-key': apiKey } : {}),
        },
        body: JSON.stringify({
          message,
          employeeId: employee.id,
          employeeCode: employee.employeeCode,
        }),
        signal: AbortSignal.timeout(N8N_CHAT_TIMEOUT_MS),
      });
    } catch {
      throw new BadGatewayException(
        'Không kết nối được AI Agent (n8n). Vui lòng thử lại sau.',
      );
    }
    const latencyMs = Date.now() - startedAt;

    if (!response.ok) {
      throw new BadGatewayException(
        'AI Agent (n8n) trả về lỗi. Vui lòng thử lại sau.',
      );
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new BadGatewayException(
        'Phản hồi từ AI Agent (n8n) không hợp lệ.',
      );
    }

    // n8n WF01 trả JSON với field `answer` (xem n8n-workflows/01-router-agent.json
    // + các sub-workflow 02/03/04 đều kết thúc bằng { answer, ... })
    const answer = (payload as { answer?: unknown } | null)?.answer;
    if (typeof answer !== 'string' || answer.length === 0) {
      throw new BadGatewayException(
        'AI Agent (n8n) không trả được câu trả lời. Vui lòng thử lại sau.',
      );
    }

    return { answer, latencyMs };
  }

  /** POST /agents/chat-session/:id/reply — human reply lưu vào lịch sử session
   *  VÀ forward ra kênh khách hàng (Slack DM) nếu session có externalId. */
  async replyToSession(sessionId: string, content: string) {
    const session = await this.prisma.aiChatSession.findUnique({
      where: { id: sessionId },
      select: { id: true, externalId: true },
    });
    if (!session) {
      throw new NotFoundException('Không tìm thấy phiên chat');
    }
    const message = await this.aiContext.saveMessage({
      sessionId,
      role: 'assistant',
      content,
      metadata: { sender: 'human', note: 'human_takeover' },
    });
    const delivery = session.externalId
      ? await this.aiContext.sendSlackDm(session.externalId, content)
      : { delivered: false, reason: 'NO_EXTERNAL_ID' };
    return { ...message, delivery };
  }

  /** GET /agents/pii-audit — message AI gần nhất kèm session (phục vụ audit PII) */
  async getPiiAudit(limit = 20) {
    const take = Math.min(Math.max(limit, 1), 100);
    const messages = await this.prisma.aiChatMessage.findMany({
      orderBy: { createdAt: 'desc' },
      take,
      include: {
        session: {
          select: { id: true, type: true, channel: true, externalId: true },
        },
      },
    });

    return {
      items: messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        metadata: m.metadata,
        createdAt: m.createdAt,
        session: {
          id: m.session.id,
          type: m.session.type,
          channel: m.session.channel,
          externalId: m.session.externalId,
        },
      })),
    };
  }

  /** GET /agents/onboarding/my — onboarding tasks của chính nhân viên đăng nhập */
  async getMyOnboarding(userId: string) {
    const employee = await this.resolveEmployee(userId);
    const progress = await this.onboarding.getEmployeeProgress(employee.id);

    return {
      items: progress.map((p) => ({
        id: p.id,
        title: p.task.title,
        description: p.task.description,
        category: p.task.category,
        isCompleted: p.status === 'COMPLETED',
        completedAt: p.completedAt,
      })),
    };
  }
}
