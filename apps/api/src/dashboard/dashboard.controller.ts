import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { vnMonth } from '../common/vn-date';

@ApiTags('Dashboard')
@Controller('dashboard')
// Dashboard chỉ dành cho HR/ADMIN — trước đây chỉ JwtAuthGuard.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN_GROUP')
@ApiBearerAuth()
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('kpis')
  @ApiOperation({ summary: 'Lấy KPI tổng hợp cho Dashboard' })
  getKpis() {
    return this.dashboardService.getKpis();
  }

  @Get('attendance-chart')
  @ApiOperation({ summary: 'Biểu đồ chấm công theo ngày trong tháng' })
  getAttendanceChart(
    @Query('month') month: string,
    @Query('year') year: string,
  ) {
    const { year: y, month: m } = vnMonth();
    const parsedMonth = Number(month);
    const parsedYear = Number(year);
    return this.dashboardService.getAttendanceChart(
      Number.isInteger(parsedMonth) && parsedMonth >= 1 && parsedMonth <= 12 ? parsedMonth : m,
      Number.isInteger(parsedYear) && parsedYear >= 2000 && parsedYear <= 2100 ? parsedYear : y,
    );
  }

  @Get('department-distribution')
  @ApiOperation({ summary: 'Phân bổ nhân sự theo phòng ban' })
  getDepartmentDistribution() {
    return this.dashboardService.getDepartmentDistribution();
  }

  @Get('pending-leaves')
  @ApiOperation({ summary: 'Danh sách đơn nghỉ phép chờ duyệt' })
  getPendingLeaves() {
    return this.dashboardService.getPendingLeaves();
  }

  @Get('ai-activity')
  @ApiOperation({ summary: 'Thống kê tổng hợp hiệu năng AI agents theo workflow' })
  getAiActivity() {
    return this.dashboardService.getAiActivity();
  }
}
