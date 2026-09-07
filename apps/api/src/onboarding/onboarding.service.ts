import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OnboardingService {
  constructor(private prisma: PrismaService) {}

  // ── Tasks (Templates) ─────────────────────────────────────────────────────

  findAllTasks() {
    return this.prisma.onboardingTask.findMany({
      include: { _count: { select: { progresses: true } } },
      orderBy: { order: 'asc' },
    });
  }

  createTask(dto: {
    title: string;
    description?: string;
    category: string;
    dueAfterDays?: number;
    isRequired?: boolean;
    order?: number;
  }) {
    return this.prisma.onboardingTask.create({ data: dto });
  }

  updateTask(id: string, dto: Partial<{
    title: string;
    description: string;
    category: string;
    dueAfterDays: number;
    isRequired: boolean;
    order: number;
  }>) {
    return this.prisma.onboardingTask.update({ where: { id }, data: dto });
  }

  deleteTask(id: string) {
    return this.prisma.onboardingTask.delete({ where: { id } });
  }

  // ── Progress (Per Employee) ───────────────────────────────────────────────

  getEmployeeProgress(employeeId: string) {
    return this.prisma.onboardingProgress.findMany({
      where: { employeeId },
      include: { task: true },
      orderBy: { task: { order: 'asc' } },
    });
  }

  async getProgressSummary(employeeId: string) {
    const progress = await this.getEmployeeProgress(employeeId);
    const total = progress.length;
    const completed = progress.filter((p) => p.status === 'COMPLETED').length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, percentage, items: progress };
  }

  async updateProgress(
    employeeId: string,
    taskId: string,
    dto: { status: string; note?: string },
  ) {
    return this.prisma.onboardingProgress.upsert({
      where: { employeeId_taskId: { employeeId, taskId } },
      create: {
        employeeId,
        taskId,
        status: dto.status as any,
        note: dto.note,
        completedAt: dto.status === 'COMPLETED' ? new Date() : undefined,
      },
      update: {
        status: dto.status as any,
        note: dto.note,
        completedAt: dto.status === 'COMPLETED' ? new Date() : null,
      },
    });
  }

  async assignTasksToEmployee(employeeId: string) {
    const tasks = await this.prisma.onboardingTask.findMany({
      orderBy: { order: 'asc' },
    });
    if (tasks.length === 0) return [];

    await this.prisma.onboardingProgress.createMany({
      data: tasks.map((t) => ({
        employeeId,
        taskId: t.id,
        status: 'PENDING' as const,
      })),
      skipDuplicates: true,
    });

    return this.getEmployeeProgress(employeeId);
  }

  getAllProgress() {
    return this.prisma.onboardingProgress.findMany({
      include: {
        employee: {
          select: {
            id: true,
            fullName: true,
            employeeCode: true,
            joinDate: true,
            department: { select: { name: true } },
          },
        },
        task: true,
      },
      orderBy: [{ employee: { fullName: 'asc' } }, { task: { order: 'asc' } }],
    });
  }
}
