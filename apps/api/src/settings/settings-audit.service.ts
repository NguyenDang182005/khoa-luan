import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditAdminInfo {
  id?: string;
  email?: string;
}

/** Các mục ghi audit — 'account' dành cho hành động trên tài khoản (vd đặt lại mật khẩu nhân viên) */
export type AuditSection =
  | 'leave_policy'
  | 'security_policy'
  | 'ai_agent'
  | 'salary_config'
  | 'geofence'
  | 'holiday'
  | 'account';

function formatValue(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return String(v);
}

/**
 * Nhật ký thay đổi cài đặt (append-only) — so sánh before/after và ghi từng field khác nhau.
 * Dùng bởi mọi endpoint ghi cài đặt: leave-policy, security-policy, ai-config, salary-config, geofence.
 */
@Injectable()
export class SettingsAuditService {
  private readonly logger = new Logger(SettingsAuditService.name);

  constructor(private prisma: PrismaService) {}

  /** @returns số dòng audit đã ghi */
  async logChanges(params: {
    section: AuditSection;
    admin: AuditAdminInfo;
    before: Record<string, unknown>;
    after: Record<string, unknown>;
  }): Promise<number> {
    const { section, admin, before, after } = params;

    // Bỏ qua field hệ thống — không phải "thay đổi cài đặt" thật
    const SKIP_FIELDS = new Set(['updatedAt', 'createdAt', 'id']);

    const rows = Object.keys(after)
      .filter((field) => !SKIP_FIELDS.has(field))
      .filter((field) => formatValue(before[field]) !== formatValue(after[field]))
      .map((field) => ({
        adminUserId: admin.id ?? null,
        adminEmail: admin.email ?? 'unknown',
        section,
        field,
        oldValue: formatValue(before[field]),
        newValue: formatValue(after[field]),
      }));

    if (rows.length === 0) return 0;

    try {
      await this.prisma.settingsAuditLog.createMany({ data: rows });
    } catch (e) {
      // Audit lỗi không được chặn nghiệp vụ — chỉ log cảnh báo
      this.logger.warn(`Không ghi được audit log cho ${section}: ${(e as Error).message}`);
    }
    return rows.length;
  }

  /**
   * Ghi 1 dòng audit cho một HÀNH ĐỘNG tài khoản (vd: admin đặt lại mật khẩu nhân viên).
   * Khác với logChanges (so sánh before/after từng field), method này ghi đúng 1 row tùy ý.
   * ⚠️ Giá trị nhạy cảm (mật khẩu, token...) phải được caller CHE SẴN trước khi truyền vào.
   */
  async logAction(params: {
    section: AuditSection;
    admin: AuditAdminInfo;
    field: string;
    oldValue: string | null;
    newValue: string | null;
  }): Promise<number> {
    try {
      await this.prisma.settingsAuditLog.create({
        data: {
          adminUserId: params.admin.id ?? null,
          adminEmail: params.admin.email ?? 'unknown',
          section: params.section,
          field: params.field,
          oldValue: params.oldValue,
          newValue: params.newValue,
        },
      });
    } catch (e) {
      // Audit lỗi không được chặn nghiệp vụ — chỉ log cảnh báo
      this.logger.warn(`Không ghi được audit log cho ${params.section}: ${(e as Error).message}`);
      return 0;
    }
    return 1;
  }
}
