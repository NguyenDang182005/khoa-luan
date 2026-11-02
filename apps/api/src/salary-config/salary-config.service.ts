import { Injectable } from '@nestjs/common';
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
    const year = new Date().getFullYear();
    const config = await this.prisma.salaryConfig.findFirst({
      where: { year: { lte: year } },
      orderBy: { year: 'desc' },
    });
    // Chưa có cấu hình: trả đúng mặc định mà Rule Engine sẽ dùng cho tháng hiện tại
    const { year: y, month } = vnMonth();
    return config ?? { year, ...defaultSalaryConfigFor(vnDateFromParts(y, month, 1)) };
  }

  async upsert(
    dto: {
      year: number;
      bhxhRate?: number;
      bhytRate?: number;
      bhtnRate?: number;
      pitFreeAmount?: number;
      overtimeRate?: number;
      otWeekendRate?: number;
      otHolidayRate?: number;
      standardWorkHours?: number;
    },
    admin: { id?: string; email?: string },
  ) {
    const before = await this.prisma.salaryConfig.findUnique({ where: { year: dto.year } });
    const after = await this.prisma.salaryConfig.upsert({
      where: { year: dto.year },
      create: dto,
      update: dto,
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
