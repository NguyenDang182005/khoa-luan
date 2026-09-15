import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

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
  ) {}

  /** Vùng chấm công — tự tạo bản ghi default khi chưa có */
  async getGeofence() {
    const existing = await this.prisma.officeGeofence.findUnique({ where: { id: 'default' } });
    if (existing) return existing;
    return this.prisma.officeGeofence.create({
      data: { id: 'default', name: 'Văn phòng công ty', lat: 10.7951, lng: 106.7218, radiusM: 200 },
    });
  }

  async updateGeofence(dto: { name?: string; lat?: number; lng?: number; radiusM?: number }) {
    await this.getGeofence(); // đảm bảo bản ghi default tồn tại
    return this.prisma.officeGeofence.update({
      where: { id: 'default' },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.lat !== undefined ? { lat: dto.lat } : {}),
        ...(dto.lng !== undefined ? { lng: dto.lng } : {}),
        ...(dto.radiusM !== undefined ? { radiusM: dto.radiusM } : {}),
      },
    });
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
        name: 'Google Gemini 2.5 Flash',
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
          name: 'Google Gemini 2.5 Flash',
          status: res.ok ? 'ok' : 'error',
          latencyMs: Date.now() - tg,
          detail: res.ok ? 'API key hợp lệ (GET /v1beta/models)' : `HTTP ${res.status} — key có thể đã hết hạn`,
        });
      } catch (e) {
        items.push({
          key: 'gemini',
          name: 'Google Gemini 2.5 Flash',
          status: 'error',
          latencyMs: null,
          detail: (e as Error).message.slice(0, 100),
        });
      }
    }

    return { checkedAt: new Date().toISOString(), items };
  }
}
