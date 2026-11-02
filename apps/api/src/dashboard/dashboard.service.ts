import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { vnDateUtc, vnMonth, vnMonthRange } from '../common/vn-date';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getKpis() {
    const { year, month } = vnMonth();
    const today = vnDateUtc();
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [totalEmployees, todayAttendances, monthPayrolls, escalations, recentAiMessages] =
      await Promise.all([
        this.prisma.employee.count({ where: { status: { not: 'TERMINATED' } } }),
        this.prisma.attendance.findMany({ where: { date: today } }),
        this.prisma.payroll.findMany({ where: { month, year, status: { not: 'CANCELLED' } } }),
        this.prisma.aiChatSession.count({ where: { type: 'CSKH', escalatedAt: { not: null } } }),
        this.prisma.aiChatMessage.findMany({
          where: { createdAt: { gte: weekAgo } },
          select: { metadata: true },
        }),
      ]);

    // Số workflow thực sự hoạt động trong 7 ngày qua: đếm distinct các
    // discriminator mà n8n lưu trong metadata (intent | scenarioType | escalated)
    // — HR_QA → wf02, TRAINING/scenarioType → wf03, CSKH/escalated → wf04.
    const activeWorkflows = this.countActiveWorkflows(recentAiMessages);

    const onTime = todayAttendances.filter(a => a.status === 'PRESENT').length;
    const late = todayAttendances.filter(a => a.status === 'LATE').length;
    const onLeave = todayAttendances.filter(a => a.status === 'ON_LEAVE').length;
    const todayTotal = totalEmployees;
    const todayAttendanceRate = todayTotal > 0 ? Math.round(((onTime + late) / todayTotal) * 1000) / 10 : 0;

    const monthlyPayrollTotal = monthPayrolls.reduce((sum, p) => sum + p.netSalary, 0);

    // AI resolution rate: sessions without escalation / total CSKH (null nếu chưa có dữ liệu)
    const cskhTotal = await this.prisma.aiChatSession.count({ where: { type: 'CSKH' } });
    const aiResolutionRate = cskhTotal > 0 ? Math.round(((cskhTotal - escalations) / cskhTotal) * 1000) / 10 : null;

    // Total AI queries
    const totalAiMessages = await this.prisma.aiChatMessage.count({ where: { role: 'user' } });

    return {
      totalEmployees,
      todayAttendanceRate,
      todayDetail: { onTime, late, onLeave },
      monthlyPayrollTotal,
      aiResolutionRate,
      escalationCount: escalations,
      activeWorkflows,
      totalAiMessages,
    };
  }

  async getAttendanceChart(month: number, year: number) {
    const { gte, lt } = vnMonthRange(year, month);

    const attendances = await this.prisma.attendance.findMany({
      where: { date: { gte, lt } },
    });

    const dayMap = new Map<string, { onTime: number; late: number; leave: number }>();
    for (const a of attendances) {
      const key = `${String(a.date.getDate()).padStart(2, '0')}/${String(month).padStart(2, '0')}`;
      if (!dayMap.has(key)) dayMap.set(key, { onTime: 0, late: 0, leave: 0 });
      const entry = dayMap.get(key)!;
      if (a.status === 'PRESENT') entry.onTime++;
      else if (a.status === 'LATE') entry.late++;
      else if (a.status === 'ON_LEAVE') entry.leave++;
    }

    return Array.from(dayMap.entries()).map(([day, v]) => ({ day, ...v }));
  }

  async getDepartmentDistribution() {
    const departments = await this.prisma.department.findMany({
      include: { _count: { select: { employees: true } } },
    });
    return departments.map(d => ({ name: d.name, value: d._count.employees }));
  }

  async getPendingLeaves() {
    return this.prisma.leaveRequest.findMany({
      where: { status: 'PENDING' },
      include: { employee: { select: { id: true, fullName: true, employeeCode: true, department: { select: { name: true } } } } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
  }

  async getAiActivity() {
    const WORKFLOWS = [
      { key: 'HR_QA',    wf: 'WF02', label: 'HR Q&A',    desc: 'Trả lời chính sách nội bộ' },
      { key: 'TRAINING', wf: 'WF03', label: 'Training',   desc: 'Đào tạo & kiểm tra kiến thức' },
      { key: 'CSKH',     wf: 'WF04', label: 'CSKH Zalo',  desc: 'Chăm sóc khách hàng Zalo' },
    ] as const;

    const results = await Promise.all(
      WORKFLOWS.map(async ({ key, wf, label, desc }) => {
        // Cửa sổ 90 ngày (đủ cho dữ liệu demo) + take 1000 để không nạp cả bảng message
        const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        const [messages, total, escalated] = await Promise.all([
          this.prisma.aiChatMessage.findMany({
            where: {
              role: 'assistant',
              session: { type: key as any },
              createdAt: { gte: since },
            },
            select: { metadata: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
            take: 1000,
          }),
          this.prisma.aiChatMessage.count({
            where: { role: 'assistant', session: { type: key as any } },
          }),
          key === 'CSKH'
            ? this.prisma.aiChatSession.count({
                where: { type: 'CSKH', escalatedAt: { not: null } },
              })
            : Promise.resolve(0),
        ]);

        const latencies = messages
          .map(m => (m.metadata as any)?.latency_ms as number | null)
          .filter((v): v is number => typeof v === 'number' && v > 0);

        const avgLatencyMs = latencies.length
          ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
          : null;

        return {
          wf,
          label,
          desc,
          total,
          avgLatencyMs,
          escalated: key === 'CSKH' ? escalated : null,
          lastActiveAt: messages[0]?.createdAt ?? null,
        };
      }),
    );

    return results;
  }

  /** Đếm số n8n workflow thực sự có hoạt động trong 7 ngày qua, dựa trên
   *  discriminator mà n8n lưu trong AiChatMessage.metadata:
   *  - WF02 (HR Q&A):  metadata.intent === 'HR_QA'
   *  - WF03 (Training): metadata.intent === 'TRAINING' hoặc có metadata.scenarioType
   *  - WF04 (Zalo CSKH): metadata.intent === 'CSKH' hoặc metadata.escalated === true
   *  Không có message nào → 0 (không hardcode số workflow). */
  private countActiveWorkflows(messages: { metadata: unknown }[]): number {
    const workflows = new Set<string>();
    for (const m of messages) {
      const meta = m.metadata as Record<string, unknown> | null;
      if (!meta) continue;
      const intent = typeof meta.intent === 'string' ? meta.intent : undefined;
      if (intent === 'HR_QA') workflows.add('wf02');
      if (intent === 'TRAINING' || typeof meta.scenarioType === 'string') {
        workflows.add('wf03');
      }
      if (intent === 'CSKH' || meta.escalated === true) workflows.add('wf04');
    }
    return workflows.size;
  }
}
