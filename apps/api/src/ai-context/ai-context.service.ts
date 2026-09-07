import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CanActivate, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

/** Guard: validates x-api-key header — used for n8n internal calls */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const key = req.headers['x-api-key'];
    const expected = this.config.get<string>('N8N_API_KEY');
    if (!expected || key !== expected) {
      throw new UnauthorizedException('Invalid API Key');
    }
    return true;
  }
}

@Injectable()
export class AiContextService {
  constructor(private prisma: PrismaService) {}

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
        leaveRequests: {
          where: {
            status: 'APPROVED',
            startDate: { gte: new Date(new Date().getFullYear(), 0, 1) },
          },
          select: { type: true, totalDays: true },
        },
      },
    });

    const annualLeaveUsed = employee.leaveRequests
      .filter((l) => l.type === 'ANNUAL')
      .reduce((s, l) => s + l.totalDays, 0);

    // Đọc số ngày phép từ contract thay vì hardcode 12
    const activeContract = employee.contracts[0];
    const annualLeaveTotal: number =
      (activeContract?.allowances as any)?.annualLeaveDays ?? 12;

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
          total: annualLeaveTotal,
          used: annualLeaveUsed,
          remaining: annualLeaveTotal - annualLeaveUsed,
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

  async createOrGetSession(dto: {
    employeeId?: string;
    type: string;
    channel: string;
    externalId?: string;
  }) {
    // Resolve employeeCode (EMP003) → UUID nếu cần
    let resolvedEmployeeId: string | null = dto.employeeId ?? null;
    if (resolvedEmployeeId && /^EMP\d+$/i.test(resolvedEmployeeId)) {
      const emp = await this.prisma.employee.findFirst({
        where: { employeeCode: resolvedEmployeeId },
        select: { id: true },
      });
      resolvedEmployeeId = emp?.id ?? null;
    }

    // Q7: Tìm session gần nhất của người dùng
    const lookupId = dto.externalId || resolvedEmployeeId;
    if (lookupId) {
      const existing = await this.prisma.aiChatSession.findFirst({
        where: {
          OR: [
            dto.externalId ? { externalId: dto.externalId } : {},
            resolvedEmployeeId
              ? {
                  employeeId: resolvedEmployeeId,
                  type: dto.type as any,
                  channel: dto.channel,
                }
              : {},
          ].filter((o) => Object.keys(o).length > 0),
        },
        orderBy: { createdAt: 'desc' },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
      });

      if (existing) {
        // Kiểm tra xem session có cùng ngày hôm nay (múi giờ VN) hay không
        const nowVn = new Date().toLocaleDateString('en-CA', {
          timeZone: 'Asia/Ho_Chi_Minh',
        });
        const sessionVn = existing.updatedAt.toLocaleDateString('en-CA', {
          timeZone: 'Asia/Ho_Chi_Minh',
        });
        const isSameDay = sessionVn === nowVn;

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

  saveMessage(dto: {
    sessionId: string;
    role: string;
    content: string;
    metadata?: object;
  }) {
    return this.prisma.aiChatMessage.create({
      data: {
        sessionId: dto.sessionId,
        role: dto.role,
        content: dto.content,
        metadata: dto.metadata ?? undefined,
      },
    });
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
    // 1. Tắt bot đối với session này để nhường quyền cho nhân viên
    if (dto.sessionId) {
      await this.prisma.aiChatSession
        .update({
          where: { id: dto.sessionId },
          data: { isActive: false },
        })
        .catch(() => null);
    }

    // 2. Tạo notification cảnh báo Admin
    return this.prisma.notification.create({
      data: {
        // 'admin-broadcast' là sentinel userId — gateway emit đến room 'admin'
        userId: 'admin-broadcast',
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
    });
  }

  /** Cho phép Admin chủ động bật lại Bot ngay trên Web Portal mà không cần chờ qua 12h đêm */
  async reactivateSession(sessionId: string) {
    return this.prisma.aiChatSession.update({
      where: { id: sessionId },
      data: { isActive: true },
    });
  }
}
