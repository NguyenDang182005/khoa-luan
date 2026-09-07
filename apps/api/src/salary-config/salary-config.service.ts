import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SalaryConfigService {
  constructor(private prisma: PrismaService) {}

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
    // Return defaults if no config found
    return (
      config ?? {
        year,
        bhxhRate: 0.08,
        bhytRate: 0.015,
        bhtnRate: 0.01,
        pitFreeAmount: 11_000_000,
        overtimeRate: 1.5,
        otWeekendRate: 2.0,
        otHolidayRate: 3.0,
        standardWorkHours: 8,
      }
    );
  }

  upsert(dto: {
    year: number;
    bhxhRate?: number;
    bhytRate?: number;
    bhtnRate?: number;
    pitFreeAmount?: number;
    overtimeRate?: number;
    otWeekendRate?: number;
    otHolidayRate?: number;
    standardWorkHours?: number;
  }) {
    return this.prisma.salaryConfig.upsert({
      where: { year: dto.year },
      create: dto,
      update: dto,
    });
  }
}
