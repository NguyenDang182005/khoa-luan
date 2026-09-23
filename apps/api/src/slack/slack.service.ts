import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { App } from '@slack/bolt';

@Injectable()
export class SlackService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(SlackService.name);
  private boltApp: App | null = null;

  constructor(private readonly config: ConfigService) {}

  async onApplicationBootstrap() {
    const token = this.config.get<string>('SLACK_BOT_TOKEN');
    const appToken = this.config.get<string>('SLACK_APP_TOKEN');

    if (!token || !appToken) {
      this.logger.warn(
        'SLACK_BOT_TOKEN hoặc SLACK_APP_TOKEN chưa cấu hình → Slack Socket Mode bị tắt',
      );
      return;
    }

    this.boltApp = new App({
      token,
      appToken,
      socketMode: true,
      logLevel: 'warn' as any,
    });

    // Nhận message từ channel (không phải DM, không phải bot)
    this.boltApp.event('message', async ({ event }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const msg = event as any;

      // Log tất cả events để debug
      this.logger.log(
        `[Slack] Nhận event: user=${msg.user ?? 'bot'} bot_id=${msg.bot_id ?? '-'} subtype=${msg.subtype ?? '-'} channel_type=${msg.channel_type ?? '-'} channel=${msg.channel ?? '-'}`,
      );

      // Bỏ qua tin từ bot, subtypes (edit/delete), DM
      // channel_type = 'channel' | undefined (một số Slack plan không gửi field này)
      if (
        msg.bot_id ||
        msg.subtype ||
        (msg.channel_type && msg.channel_type !== 'channel')
      ) {
        this.logger.log(`[Slack] Bỏ qua event (bot/subtype/DM)`);
        return;
      }
      if (!msg.text) { this.logger.warn('[Slack] Message không có text, bỏ qua'); return; }

      this.logger.log(`[Slack] ✉️ Tin nhắn từ ${msg.user}: "${msg.text.slice(0, 80)}"`);

      // threadTs: nếu message đang trong thread → dùng thread_ts (reply cùng thread)
      //           nếu là message gốc          → dùng ts  (tạo thread mới)
      const threadTs = (msg as any).thread_ts ?? msg.ts;

      const payload = {
        userId: msg.user,
        message: msg.text,
        originalMessage: msg.text,
        channel: 'zalo',          // Giữ "zalo" cho DB (backward-compat)
        externalId: msg.user,
        slackChannel: msg.channel, // Slack channel ID thực (C...)
        threadTs,                  // Dùng để bot reply trong đúng thread
      };

      const n8nUrl =
        this.config.get<string>('N8N_CSKH_WEBHOOK_URL') ??
        'http://localhost:5678/webhook/zalo-webhook';

      this.logger.log(`[Slack] → Forwarding tới n8n: ${n8nUrl}`);

      try {
        const res = await fetch(n8nUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(90_000),
        });
        if (!res.ok) {
          this.logger.error(
            `n8n WF04 webhook trả ${res.status}: ${await res.text()}`,
          );
        } else {
          this.logger.log(`[Slack] ✅ n8n đã nhận, status=${res.status}`);
        }
      } catch (e) {
        this.logger.error(
          `Forward Slack → n8n thất bại: ${(e as Error).message}`,
        );
      }
    });

    await this.boltApp.start();
    this.logger.log('✅ Slack Socket Mode client đã kết nối');
  }

  async onApplicationShutdown() {
    if (this.boltApp) {
      await this.boltApp.stop();
      this.logger.log('Slack Socket Mode client đã dừng');
    }
  }
}
