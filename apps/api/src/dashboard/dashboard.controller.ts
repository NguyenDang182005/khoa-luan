import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Dashboard')
@Controller('dashboard')
@UseGuards(JwtAuthGuard)
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
    const now = new Date();
    return this.dashboardService.getAttendanceChart(
      month ? parseInt(month) : now.getMonth() + 1,
      year ? parseInt(year) : now.getFullYear(),
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
