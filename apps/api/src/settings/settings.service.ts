import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateLeavePolicyDto } from './dto/update-leave-policy.dto';
import { UpdateSecurityPolicyDto } from './dto/update-security-policy.dto';
import { UpdateAiAgentConfigDto } from './dto/update-ai-agent-config.dto';
import { SettingsAuditService } from './settings-audit.service';
import { dayKey } from '../common/workdays';
import { vnDateUtc, vnMonth } from '../common/vn-date';
import {
  ensureDefaultLeavePolicy,
  ensureDefaultSecurityPolicy,
  ensureDefaultAiAgentConfig,
  ensureDefaultGeofence,
} from './single-row.utils';

export interface IntegrationStatus {
  key: string;
  name: string;
  status: 'ok' | 'error' | 'not_configured';
  latencyMs: number | null;
  detail: string | null;
}

async function fetchWithTimeout(url: string, init: RequestInit & { timeoutMs?: number }) {
  const { timeoutMs = 4000, ...rest } = init;
  return fetch(url, { ...rest, signal: AbortSignal.timeout(timeoutMs) });
}

@Injectable()
export class SettingsService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private audit: SettingsAuditService,
  ) {}

  /** Vùng chấm công — tự tạo bản ghi default khi chưa có */
  getGeofence() {
    return ensureDefaultGeofence(this.prisma);
  }

  async updateGeofence(
    dto: { name?: string; lat?: number; lng?: number; radiusM?: number },
    admin: { id?: string; email?: string },
  ) {
    const before = await this.getGeofence(); // đảm bảo bản ghi default tồn tại
    const after = await this.prisma.officeGeofence.update({
      where: { id: 'default' },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.lat !== undefined ? { lat: dto.lat } : {}),
        ...(dto.lng !== undefined ? { lng: dto.lng } : {}),
        ...(dto.radiusM !== undefined ? { radiusM: dto.radiusM } : {}),
      },
    });
    await this.audit.logChanges({
      section: 'geofence',
      admin,
      before: before as unknown as Record<string, unknown>,
      after: after as unknown as Record<string, unknown>,
    });
    return after;
  }

  // ── Ngày lễ quốc gia ──

  /** Danh sách ngày lễ của một năm (mặc định năm hiện tại theo giờ VN). */
  async getHolidays(year?: number) {
    const y =
      typeof year === 'number' && Number.isFinite(year) && year > 2000
        ? year
        : vnMonth().year;
    return this.prisma.holiday.findMany({
      where: {
        date: { gte: new Date(Date.UTC(y, 0, 1)), lt: new Date(Date.UTC(y + 1, 0, 1)) },
      },
      orderBy: { date: 'asc' },
    });
  }

  async createHoliday(
    dto: { date: string; name: string },
    admin: { id?: string; email?: string },
  ) {
    if (!dto.date) throw new BadRequestException('Thiếu ngày lễ');
    if (!dto.name?.trim()) throw new BadRequestException('Thiếu tên ngày lễ');

    const raw = new Date(dto.date);
    if (Number.isNaN(raw.getTime())) {
      throw new BadRequestException('Ngày lễ không hợp lệ');
    }
    const date = vnDateUtc(raw);
    const existing = await this.prisma.holiday.findUnique({ where: { date } });
    if (existing) {
      throw new ConflictException(`Ngày ${dayKey(date)} đã có trong lịch nghỉ`);
    }

    const created = await this.prisma.holiday.create({
      data: { date, name: dto.name.trim() },
    });
    await this.audit.logAction({
      section: 'holiday',
      admin,
      field: 'date',
      oldValue: null,
      newValue: `${dayKey(date)} — ${created.name}`,
    });
    return created;
  }

  async deleteHoliday(id: string, admin: { id?: string; email?: string }) {
    const row = await this.prisma.holiday.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Không tìm thấy ngày lễ');
    await this.prisma.holiday.delete({ where: { id } });
    await this.audit.logAction({
      section: 'holiday',
      admin,
      field: 'date',
      oldValue: `${dayKey(row.date)} — ${row.name}`,
      newValue: null,
    });
    return { deleted: true };
  }

  /** Chính sách phép năm — tự tạo bản ghi default khi chưa có */
  async getLeavePolicy() {
    return ensureDefaultLeavePolicy(this.prisma);
  }

  async updateLeavePolicy(dto: UpdateLeavePolicyDto, admin: { id?: string; email?: string }) {
    const before = await this.getLeavePolicy();
    const after = await this.prisma.leavePolicy.update({
      where: { id: 'default' },
      data: {
        ...(dto.annualQuotaDays !== undefined ? { annualQuotaDays: dto.annualQuotaDays } : {}),
        ...(dto.seniorityBonusEveryYears !== undefined
          ? { seniorityBonusEveryYears: dto.seniorityBonusEveryYears }
          : {}),
        ...(dto.seniorityBonusDays !== undefined ? { seniorityBonusDays: dto.seniorityBonusDays } : {}),
        ...(dto.prorateByJoinMonth !== undefined ? { prorateByJoinMonth: dto.prorateByJoinMonth } : {}),
        ...(dto.maxCarryOverDays !== undefined ? { maxCarryOverDays: dto.maxCarryOverDays } : {}),
        ...(dto.note !== undefined ? { note: dto.note } : {}),
      },
    });
    await this.audit.logChanges({
      section: 'leave_policy',
      admin,
      before: before as unknown as Record<string, unknown>,
      after: after as unknown as Record<string, unknown>,
    });
    return after;
  }

  /** Chính sách bảo mật — tự tạo bản ghi default khi chưa có */
  async getSecurityPolicy() {
    return ensureDefaultSecurityPolicy(this.prisma);
  }

  async updateSecurityPolicy(dto: UpdateSecurityPolicyDto, admin: { id?: string; email?: string }) {
    const before = await this.getSecurityPolicy();
    const after = await this.prisma.securityPolicy.update({
      where: { id: 'default' },
      data: {
        ...(dto.passwordMinLength !== undefined ? { passwordMinLength: dto.passwordMinLength } : {}),
        ...(dto.requireUppercase !== undefined ? { requireUppercase: dto.requireUppercase } : {}),
        ...(dto.requireLowercase !== undefined ? { requireLowercase: dto.requireLowercase } : {}),
        ...(dto.requireDigit !== undefined ? { requireDigit: dto.requireDigit } : {}),
        ...(dto.requireSpecial !== undefined ? { requireSpecial: dto.requireSpecial } : {}),
        ...(dto.passwordMaxAgeDays !== undefined ? { passwordMaxAgeDays: dto.passwordMaxAgeDays } : {}),
        ...(dto.maxFailedAttempts !== undefined ? { maxFailedAttempts: dto.maxFailedAttempts } : {}),
        ...(dto.lockoutMinutes !== undefined ? { lockoutMinutes: dto.lockoutMinutes } : {}),
        ...(dto.accessTokenTtlHours !== undefined ? { accessTokenTtlHours: dto.accessTokenTtlHours } : {}),
      },
    });
    await this.audit.logChanges({
      section: 'security_policy',
      admin,
      before: before as unknown as Record<string, unknown>,
      after: after as unknown as Record<string, unknown>,
    });
    return after;
  }

  /**
   * Danh sách phiên đăng nhập active (mọi user) — mới nhất trước.
   * QUAN TRỌNG: KHÔNG trả về trường `token` (refresh-token JWT) — không lộ phiên cho người xem.
   */
  async getActiveSessions() {
    return this.prisma.refreshToken.findMany({
      where: { expiresAt: { gt: new Date() } },
      select: {
        id: true,
        userId: true,
        ip: true,
        userAgent: true,
        createdAt: true,
        expiresAt: true,
        user: { select: { email: true, role: true, lastLoginAt: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  /** Thu hồi 1 phiên cụ thể (xóa refresh token → access token chết ở request kế tiếp nhờ sid) */
  async revokeSession(sessionId: string) {
    const session = await this.prisma.refreshToken.findUnique({ where: { id: sessionId } });
    if (!session) return { revoked: false, reason: 'NOT_FOUND' };
    await this.prisma.refreshToken.delete({ where: { id: sessionId } });
    return { revoked: true, userId: session.userId };
  }

  /** Thu hồi mọi phiên khác của 1 user (giữ lại phiên hiện tại sid) */
  async revokeOtherSessions(userId: string, currentSessionId?: string) {
    const res = await this.prisma.refreshToken.deleteMany({
      where: {
        userId,
        ...(currentSessionId ? { id: { not: currentSessionId } } : {}),
      },
    });
    return { revoked: res.count };
  }

  /** Lịch sử đăng nhập gần nhất */
  async getLoginHistory(limit = 20) {
    const safeLimit = Math.min(Math.max(1, limit), 100);
    return this.prisma.loginHistory.findMany({
      orderBy: { createdAt: 'desc' },
      take: safeLimit,
      include: { user: { select: { email: true, role: true } } },
    });
  }

  // ── AI Agent ──

  /** Cấu hình AI Agent — KHÔNG trả apiKey, chỉ trả apiKeySet (write-only) */
  async getAiConfig() {
    const cfg = await ensureDefaultAiAgentConfig(this.prisma);
    return {
      id: cfg.id,
      enabled: cfg.enabled,
      webhookUrl: cfg.webhookUrl,
      apiKeySet: Boolean(cfg.apiKey),
      timeoutMs: cfg.timeoutMs,
      createdAt: cfg.createdAt,
      updatedAt: cfg.updatedAt,
    };
  }

  async updateAiConfig(dto: UpdateAiAgentConfigDto, admin: { id?: string; email?: string }) {
    const before = await ensureDefaultAiAgentConfig(this.prisma);
    const after = await this.prisma.aiAgentConfig.update({
      where: { id: 'default' },
      data: {
        ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {}),
        ...(dto.webhookUrl !== undefined
          ? { webhookUrl: dto.webhookUrl === '' ? null : dto.webhookUrl }
          : {}),
        ...(dto.apiKey !== undefined ? { apiKey: dto.apiKey === '' ? null : dto.apiKey } : {}),
        ...(dto.timeoutMs !== undefined ? { timeoutMs: dto.timeoutMs } : {}),
      },
    });
    // Audit: không ghi giá trị apiKey thật (secret) — chỉ ghi "•••" khi đặt/xóa
    await this.audit.logChanges({
      section: 'ai_agent',
      admin,
      before: {
        enabled: before.enabled,
        webhookUrl: before.webhookUrl,
        apiKey: before.apiKey ? '•••' : null,
        timeoutMs: before.timeoutMs,
      },
      after: {
        enabled: after.enabled,
        webhookUrl: after.webhookUrl,
        apiKey: after.apiKey ? '•••' : null,
        timeoutMs: after.timeoutMs,
      },
    });
    return this.getAiConfig();
  }

  /** Kiểm tra kết nối AI Agent: ping n8n /healthz + 1 tin nhắn round-trip qua webhook */
  async testAiConnection(adminUserId?: string) {
    const cfg = await ensureDefaultAiAgentConfig(this.prisma);
    const envWebhook = this.config.get<string>('N8N_WEBHOOK_URL') ?? 'http://localhost:5678/webhook/chat';
    const webhookUrl = cfg.webhookUrl || envWebhook;
    const apiKey = cfg.apiKey || this.config.get<string>('N8N_API_KEY') || '';
    const n8nBase = webhookUrl.replace(/\/webhook\/.*$/, '');

    // 1) healthz ping
    const t0 = Date.now();
    let healthz: { ok: boolean; latencyMs: number | null; detail: string };
    try {
      const res = await fetch(`${n8nBase}/healthz`, { signal: AbortSignal.timeout(4000) });
      healthz = {
        ok: res.ok,
        latencyMs: Date.now() - t0,
        detail: res.ok ? `GET ${n8nBase}/healthz OK` : `HTTP ${res.status}`,
      };
    } catch (e) {
      healthz = {
        ok: false,
        latencyMs: null,
        detail: `Không kết nối được n8n: ${(e as Error).message.slice(0, 100)}`,
      };
    }

    // 2) Round-trip: tin nhắn "ping" → WF01 định tuyến OTHER → trả lời tĩnh, không tốn quota LLM
    let roundTrip: { ok: boolean; latencyMs: number | null; detail: string } | null = null;
    if (healthz.ok) {
      const t1 = Date.now();
      try {
        const res = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(apiKey ? { 'x-api-key': apiKey } : {}),
          },
          body: JSON.stringify({
            message: '[Test kết nối từ trang Cài Đặt] ping',
            channel: 'web',
            employeeId: adminUserId ?? 'settings-test',
            sessionId: `settings-test-${Date.now()}`,
          }),
          signal: AbortSignal.timeout(Math.min(cfg.timeoutMs, 20000)),
        });
        const latency = Date.now() - t1;
        if (!res.ok) {
          roundTrip = { ok: false, latencyMs: latency, detail: `Webhook trả HTTP ${res.status}` };
        } else {
          const payload = (await res.json().catch(() => null)) as { answer?: unknown } | null;
          roundTrip =
            payload && typeof payload.answer === 'string' && payload.answer.length > 0
              ? { ok: true, latencyMs: latency, detail: `Webhook trả lời sau ${latency}ms` }
              : { ok: false, latencyMs: latency, detail: 'Webhook phản hồi nhưng thiếu trường answer' };
        }
      } catch (e) {
        roundTrip = {
          ok: false,
          latencyMs: null,
          detail: `Không gọi được webhook: ${(e as Error).message.slice(0, 100)}`,
        };
      }
    }

    return { healthz, roundTrip };
  }

  /** Nhật ký thay đổi cài đặt — phân trang + lọc theo mục, mới nhất trước */
  async getAuditLog(params: { page?: number; limit?: number; section?: string }) {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(Math.max(1, params.limit ?? 20), 100);
    const where = params.section ? { section: params.section } : {};

    const [items, total] = await Promise.all([
      this.prisma.settingsAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.settingsAuditLog.count({ where }),
    ]);

    return { items, total, page, pageCount: Math.ceil(total / limit) };
  }

  /** Ping trạng thái các tích hợp: DB, n8n, Slack, Gemini */
  async getIntegrations(): Promise<{ checkedAt: string; items: IntegrationStatus[] }> {
    const items: IntegrationStatus[] = [];

    // 1. PostgreSQL
    const t0 = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      items.push({
        key: 'database',
        name: 'PostgreSQL (:5432)',
        status: 'ok',
        latencyMs: Date.now() - t0,
        detail: 'Truy vấn SELECT 1 thành công',
      });
    } catch (e) {
      items.push({
        key: 'database',
        name: 'PostgreSQL (:5432)',
        status: 'error',
        latencyMs: null,
        detail: (e as Error).message.slice(0, 140),
      });
    }

    // 2. n8n healthz
    const n8nUrl = this.config.get<string>('N8N_URL') ?? 'http://localhost:5678';
    const tn = Date.now();
    try {
      const res = await fetchWithTimeout(`${n8nUrl}/healthz`, { timeoutMs: 4000 });
      items.push({
        key: 'n8n',
        name: `n8n (${n8nUrl})`,
        status: res.ok ? 'ok' : 'error',
        latencyMs: Date.now() - tn,
        detail: res.ok ? 'GET /healthz OK' : `HTTP ${res.status}`,
      });
    } catch (e) {
      items.push({
        key: 'n8n',
        name: `n8n (${n8nUrl})`,
        status: 'error',
        latencyMs: null,
        detail: `Không kết nối được: ${(e as Error).message.slice(0, 100)}`,
      });
    }

    // 3. Slack Bot Token
    const slackToken = this.config.get<string>('SLACK_BOT_TOKEN');
    if (!slackToken) {
      items.push({
        key: 'slack',
        name: 'Slack (CSKH transport)',
        status: 'not_configured',
        latencyMs: null,
        detail: 'Chưa cấu hình SLACK_BOT_TOKEN trong .env — xem hướng dẫn tài liệu 09',
      });
    } else {
      const ts = Date.now();
      try {
        const res = await fetchWithTimeout('https://slack.com/api/auth.test', {
          method: 'POST',
          headers: { Authorization: `Bearer ${slackToken}`, 'Content-Type': 'application/json' },
          timeoutMs: 5000,
        });
        const body = (await res.json()) as { ok: boolean; error?: string; team?: string };
        items.push({
          key: 'slack',
          name: 'Slack (CSKH transport)',
          status: body.ok ? 'ok' : 'error',
          latencyMs: Date.now() - ts,
          detail: body.ok ? `Workspace: ${body.team ?? 'OK'}` : `Slack API lỗi: ${body.error}`,
        });
      } catch (e) {
        items.push({
          key: 'slack',
          name: 'Slack (CSKH transport)',
          status: 'error',
          latencyMs: null,
          detail: (e as Error).message.slice(0, 100),
        });
      }
    }

    // 4. Gemini API key
    const geminiKey = this.config.get<string>('GEMINI_API_KEY');
    if (!geminiKey) {
      items.push({
        key: 'gemini',
        name: 'Google Gemini 3.1 Flash Lite',
        status: 'not_configured',
        latencyMs: null,
        detail: 'Chưa cấu hình GEMINI_API_KEY',
      });
    } else {
      const tg = Date.now();
      try {
        const res = await fetchWithTimeout(
          `https://generativelanguage.googleapis.com/v1beta/models?pageSize=1&key=${encodeURIComponent(geminiKey)}`,
          { timeoutMs: 5000 },
        );
        items.push({
          key: 'gemini',
          name: 'Google Gemini 3.1 Flash Lite',
          status: res.ok ? 'ok' : 'error',
          latencyMs: Date.now() - tg,
          detail: res.ok ? 'API key hợp lệ (GET /v1beta/models)' : `HTTP ${res.status} — key có thể đã hết hạn`,
        });
      } catch (e) {
        items.push({
          key: 'gemini',
          name: 'Google Gemini 3.1 Flash Lite',
          status: 'error',
          latencyMs: null,
          detail: (e as Error).message.slice(0, 100),
        });
      }
    }

    return { checkedAt: new Date().toISOString(), items };
  }
}
