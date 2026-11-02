import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ContractsService {
  constructor(private prisma: PrismaService) {}

  findAll(employeeId?: string) {
    return this.prisma.contract.findMany({
      where: employeeId ? { employeeId } : {},
      include: {
        employee: {
          select: {
            id: true,
            fullName: true,
            employeeCode: true,
            department: { select: { name: true } },
            position: { select: { title: true } },
          },
        },
      },
      orderBy: { startDate: 'desc' },
    });
  }

  findOne(id: string) {
    return this.prisma.contract.findUniqueOrThrow({
      where: { id },
      include: { employee: true },
    });
  }

  async getActive(employeeId: string) {
    return this.prisma.contract.findFirst({
      where: { employeeId, isActive: true },
      orderBy: { startDate: 'desc' },
    });
  }

  async create(dto: {
    employeeId: string;
    contractNumber: string;
    type: string;
    startDate: Date;
    endDate?: Date;
    baseSalary: number;
    allowances?: number;
    signedDate: Date;
    fileUrl?: string;
  }) {
    // #16: deactivate + create trong 1 transaction — lỗi giữa chừng thì hợp đồng
    // cũ không bị mất trạng thái ACTIVE giữa lúc.
    return this.prisma.$transaction(async (tx) => {
      await tx.contract.updateMany({
        where: { employeeId: dto.employeeId, isActive: true },
        data: { isActive: false },
      });

      return tx.contract.create({
        data: {
          ...dto,
          type: dto.type as any,
          allowances: dto.allowances ?? 0,
          isActive: true,
        },
      });
    });
  }

  async update(
    id: string,
    dto: {
      baseSalary?: number;
      allowances?: number;
      endDate?: Date;
      fileUrl?: string;
    },
  ) {
    return this.prisma.contract.update({
      where: { id },
      data: dto,
    });
  }

  async deactivate(id: string) {
    return this.prisma.contract.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
