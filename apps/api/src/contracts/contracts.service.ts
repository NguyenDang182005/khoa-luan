import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const CONTRACT_TYPES = ['FULL_TIME', 'PART_TIME', 'PROBATION', 'FREELANCE', 'INTERNSHIP'];

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
      orderBy: [{ isActive: 'desc' }, { startDate: 'desc' }],
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
    contractNumber?: string;
    type: string;
    startDate: Date;
    endDate?: Date;
    baseSalary: number;
    allowances?: number;
    signedDate?: Date;
    fileUrl?: string;
  }) {
    if (!CONTRACT_TYPES.includes(dto.type)) {
      throw new BadRequestException(
        `Loại hợp đồng không hợp lệ — cho phép: ${CONTRACT_TYPES.join(', ')}`,
      );
    }
    if (dto.endDate && dto.endDate < dto.startDate) {
      throw new BadRequestException('Ngày kết thúc hợp đồng không được trước ngày bắt đầu');
    }
    if (!(dto.baseSalary > 0)) {
      throw new BadRequestException('Lương cơ bản phải lớn hơn 0');
    }
    if (dto.allowances !== undefined && dto.allowances < 0) {
      throw new BadRequestException('Phụ cấp không được âm');
    }
    const employee = await this.prisma.employee.findUniqueOrThrow({
      where: { id: dto.employeeId },
      select: { employeeCode: true },
    });
    const contractNumber =
      dto.contractNumber?.trim() ||
      `CTR-${employee.employeeCode}-${Date.now().toString(36).toUpperCase()}`;

    // #16: deactivate + create trong 1 transaction — lỗi giữa chừng thì hợp đồng
    // cũ không bị mất trạng thái ACTIVE giữa lúc.
    return this.prisma.$transaction(async (tx) => {
      await tx.contract.updateMany({
        where: { employeeId: dto.employeeId, isActive: true },
        data: { isActive: false },
      });

      return tx.contract.create({
        data: {
          employeeId: dto.employeeId,
          contractNumber,
          type: dto.type as any,
          startDate: dto.startDate,
          endDate: dto.endDate,
          baseSalary: dto.baseSalary,
          allowances: dto.allowances ?? 0,
          signedDate: dto.signedDate ?? dto.startDate,
          fileUrl: dto.fileUrl,
          isActive: true,
        },
      });
    });
  }

  async update(
    id: string,
    dto: {
      type?: string;
      baseSalary?: number;
      allowances?: number;
      startDate?: Date;
      endDate?: Date | null;
      fileUrl?: string;
      isActive?: boolean;
    },
  ) {
    if (dto.type !== undefined && !CONTRACT_TYPES.includes(dto.type)) {
      throw new BadRequestException(
        `Loại hợp đồng không hợp lệ — cho phép: ${CONTRACT_TYPES.join(', ')}`,
      );
    }
    if (dto.baseSalary !== undefined && !(dto.baseSalary > 0)) {
      throw new BadRequestException('Lương cơ bản phải lớn hơn 0');
    }
    if (dto.allowances !== undefined && dto.allowances < 0) {
      throw new BadRequestException('Phụ cấp không được âm');
    }
    const existing = await this.prisma.contract.findUniqueOrThrow({
      where: { id },
      select: { employeeId: true, startDate: true, endDate: true },
    });
    const effectiveStart = dto.startDate ?? existing.startDate;
    const effectiveEnd =
      dto.endDate === null ? null : dto.endDate ?? existing.endDate;
    if (effectiveEnd && effectiveEnd < effectiveStart) {
      throw new BadRequestException('Ngày kết thúc hợp đồng không được trước ngày bắt đầu');
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.isActive === true) {
        await tx.contract.updateMany({
          where: { employeeId: existing.employeeId, isActive: true, NOT: { id } },
          data: { isActive: false },
        });
      }
      return tx.contract.update({
        where: { id },
        data: {
          ...(dto.type !== undefined ? { type: dto.type as any } : {}),
          ...(dto.baseSalary !== undefined ? { baseSalary: dto.baseSalary } : {}),
          ...(dto.allowances !== undefined ? { allowances: dto.allowances } : {}),
          ...(dto.startDate !== undefined ? { startDate: dto.startDate } : {}),
          ...(dto.endDate !== undefined ? { endDate: dto.endDate } : {}),
          ...(dto.fileUrl !== undefined ? { fileUrl: dto.fileUrl } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        },
      });
    });
  }

  async activate(id: string) {
    const existing = await this.prisma.contract.findUniqueOrThrow({
      where: { id },
      select: { employeeId: true },
    });
    return this.prisma.$transaction(async (tx) => {
      await tx.contract.updateMany({
        where: { employeeId: existing.employeeId, isActive: true, NOT: { id } },
        data: { isActive: false },
      });
      return tx.contract.update({
        where: { id },
        data: { isActive: true },
      });
    });
  }

  async deactivate(id: string) {
    return this.prisma.contract.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
