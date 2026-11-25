import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsAuditService } from '../settings/settings-audit.service';
import { defaultSalaryConfigFor } from '../payroll/pit';
import { vnDateFromParts, vnMonth } from '../common/vn-date';

@Injectable()
export class SalaryConfigService {
  constructor(
    private prisma: PrismaService,
    private audit: SettingsAuditService,
  ) {}

  findAll() {
    return this.prisma.salaryConfig.findMany({ orderBy: { year: 'desc' } });
  }

  findByYear(year: number) {
    return this.prisma.salaryConfig.findUnique({ where: { year } });
  }

  async getCurrent() {
    const { year, month } = vnMonth();
    const config = await this.prisma.salaryConfig.findFirst({
      where: { year: { lte: year } },
      orderBy: { year: 'desc' },
    });
    // Chưa có cấu hình: trả đúng mặc định mà Rule Engine sẽ dùng cho tháng hiện tại
    return config ?? { year, ...defaultSalaryConfigFor(vnDateFromParts(year, month, 1)) };
  }

  async upsert(
    dto: {
      year: number;
      bhxhRate?: number;
      bhytRate?: number;
      bhtnRate?: number;
      pitFreeAmount?: number;
      pitDependentDeduction?: number;
      overtimeRate?: number;
      otWeekendRate?: number;
      otHolidayRate?: number;
      standardWorkHours?: number;
    },
    admin: { id?: string; email?: string },
  ) {
    if (!Number.isInteger(dto.year) || dto.year < 2000 || dto.year > 2100) {
      throw new BadRequestException('Năm cấu hình không hợp lệ');
    }
    if (dto.standardWorkHours !== undefined && !(dto.standardWorkHours > 0)) {
      throw new BadRequestException('Số giờ làm việc tiêu chuẩn phải lớn hơn 0');
    }
    const cleanData: Record<string, number> = { year: dto.year };
    const allowedFields = [
      'bhxhRate',
      'bhytRate',
      'bhtnRate',
      'pitFreeAmount',
      'pitDependentDeduction',
      'overtimeRate',
      'otWeekendRate',
      'otHolidayRate',
      'standardWorkHours',
    ] as const;
    for (const key of allowedFields) {
      if (dto[key] !== undefined) {
        const val = Number(dto[key]);
        if (!Number.isFinite(val) || val < 0) {
          throw new BadRequestException(`Trường ${key} không hợp lệ`);
        }
        cleanData[key] = val;
      }
    }

    const before = await this.prisma.salaryConfig.findUnique({ where: { year: dto.year } });
    const after = await this.prisma.salaryConfig.upsert({
      where: { year: dto.year },
      create: cleanData as any,
      update: cleanData as any,
    });

    // Nhật ký thay đổi — so sánh trên các field đã gửi
    await this.audit.logChanges({
      section: 'salary_config',
      admin,
      before: (before ?? {}) as unknown as Record<string, unknown>,
      after: after as unknown as Record<string, unknown>,
    });
    return after;
  }
}
