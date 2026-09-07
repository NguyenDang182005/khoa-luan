import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EmployeesService {
  constructor(private prisma: PrismaService) {}

  async findAll(params: {
    page?: number;
    limit?: number;
    search?: string;
    departmentId?: string;
    status?: string;
  }) {
    const { page = 1, limit = 10, search, departmentId, status } = params;
    const skip = (page - 1) * limit;
    const where: any = {};

    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { employeeCode: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (departmentId) where.departmentId = departmentId;
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      this.prisma.employee.findMany({
        where,
        skip,
        take: limit,
        include: {
          department: { select: { id: true, name: true, code: true } },
          position: { select: { id: true, title: true, code: true } },
          manager: {
            select: { id: true, fullName: true, employeeCode: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.employee.count({ where }),
    ]);

    return {
      success: true,
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    return this.prisma.employee.findUniqueOrThrow({
      where: { id },
      include: {
        department: true,
        position: true,
        manager: { select: { id: true, fullName: true, employeeCode: true } },
        contracts: {
          where: { isActive: true },
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
        onboardingProgress: {
          include: { task: true },
          orderBy: { task: { order: 'asc' } },
        },
      },
    });
  }

  async create(dto: {
    userId: string;
    fullName: string;
    email: string;
    phone?: string;
    gender?: string;
    dateOfBirth?: Date;
    address?: string;
    nationalId?: string;
    joinDate: Date;
    departmentId: string;
    positionId: string;
    managerId?: string;
    employeeCode?: string;
  }) {
    // Auto-generate employee code if not provided
    const code = dto.employeeCode ?? (await this.generateCode());

    const existing = await this.prisma.employee.findFirst({
      where: { OR: [{ email: dto.email }, { employeeCode: code }] },
    });
    if (existing) {
      throw new ConflictException('Email hoặc mã nhân viên đã tồn tại');
    }

    const employee = await this.prisma.employee.create({
      data: {
        ...dto,
        employeeCode: code,
        gender: dto.gender as any,
        status: 'PROBATION',
      },
    });

    // Auto-assign onboarding tasks
    await this.assignOnboardingTasks(employee.id);

    return employee;
  }

  async update(
    id: string,
    dto: {
      fullName?: string;
      phone?: string;
      address?: string;
      avatarUrl?: string;
      departmentId?: string;
      positionId?: string;
      managerId?: string;
      status?: string;
    },
  ) {
    return this.prisma.employee.update({
      where: { id },
      data: { ...dto, status: dto.status as any },
    });
  }

  async softDelete(id: string) {
    return this.prisma.employee.update({
      where: { id },
      data: { status: 'TERMINATED' },
    });
  }

  async getOrgChart() {
    const employees = await this.prisma.employee.findMany({
      where: { status: { not: 'TERMINATED' } },
      select: {
        id: true,
        fullName: true,
        employeeCode: true,
        avatarUrl: true,
        managerId: true,
        department: { select: { name: true } },
        position: { select: { title: true } },
      },
    });

    // Build tree structure
    const map = new Map(employees.map((e) => [e.id, { ...e, children: [] as any[] }]));
    const roots: any[] = [];
    for (const emp of map.values()) {
      if (emp.managerId && map.has(emp.managerId)) {
        map.get(emp.managerId)!.children.push(emp);
      } else {
        roots.push(emp);
      }
    }
    return roots;
  }

  private async generateCode(): Promise<string> {
    const count = await this.prisma.employee.count();
    return `EMP${String(count + 1).padStart(4, '0')}`;
  }

  private async assignOnboardingTasks(employeeId: string) {
    const tasks = await this.prisma.onboardingTask.findMany({
      orderBy: { order: 'asc' },
    });
    if (tasks.length === 0) return;

    await this.prisma.onboardingProgress.createMany({
      data: tasks.map((t) => ({
        employeeId,
        taskId: t.id,
        status: 'PENDING',
      })),
      skipDuplicates: true,
    });
  }
}
