import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DepartmentsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.department.findMany({
      include: {
        manager: { select: { id: true, fullName: true, employeeCode: true } },
        _count: { select: { employees: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  findOne(id: string) {
    return this.prisma.department.findUniqueOrThrow({
      where: { id },
      include: {
        manager: { select: { id: true, fullName: true } },
        children: { include: { _count: { select: { employees: true } } } },
        positions: true,
        _count: { select: { employees: true } },
      },
    });
  }

  create(dto: {
    name: string;
    code: string;
    description?: string;
    managerId?: string;
    parentId?: string;
  }) {
    return this.prisma.department.create({ data: dto });
  }

  update(
    id: string,
    dto: {
      name?: string;
      description?: string;
      managerId?: string;
      parentId?: string;
    },
  ) {
    return this.prisma.department.update({ where: { id }, data: dto });
  }

  async getTree() {
    const departments = await this.prisma.department.findMany({
      include: {
        manager: { select: { id: true, fullName: true } },
        _count: { select: { employees: true } },
      },
      orderBy: { name: 'asc' },
    });

    const map = new Map(
      departments.map((d) => [d.id, { ...d, children: [] as any[] }]),
    );
    const roots: any[] = [];

    for (const dept of map.values()) {
      if (dept.parentId && map.has(dept.parentId)) {
        map.get(dept.parentId)!.children.push(dept);
      } else {
        roots.push(dept);
      }
    }
    return roots;
  }
}
