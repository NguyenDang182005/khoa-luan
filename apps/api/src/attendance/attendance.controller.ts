import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AttendanceService } from './attendance.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { vnMonth } from '../common/vn-date';

@ApiTags('Attendance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @ApiOperation({ summary: 'Danh sách chấm công theo tháng (chỉ ADMIN)' })
  @UseGuards(RolesGuard)
  @Roles('ADMIN_GROUP')
  @Get()
  findAll(@Query('month') month: string, @Query('year') year: string) {
    const { year: y, month: m } = vnMonth();
    return this.attendanceService.findAll(Number(month) || m, Number(year) || y);
  }

  @ApiOperation({
    summary: 'Chấm công theo tháng (nhân viên chỉ xem được của chính mình)',
  })
  @Get('employee/:employeeId')
  findByEmployee(
    @Request() req: any,
    @Param('employeeId') employeeId: string,
    @Query('month') month: string,
    @Query('year') year: string,
  ) {
    const { year: y, month: m } = vnMonth();
    return this.attendanceService.findByEmployeeForViewer(
      employeeId,
      Number(month) || m,
      Number(year) || y,
      req.user.sub,
    );
  }

  @ApiOperation({ summary: 'Báo cáo tổng hợp chấm công tháng (chỉ ADMIN)' })
  @UseGuards(RolesGuard)
  @Roles('ADMIN_GROUP')
  @Get('report/:employeeId')
  getMonthlyReport(
    @Param('employeeId') employeeId: string,
    @Query('month') month: string,
    @Query('year') year: string,
  ) {
    const { year: y, month: m } = vnMonth();
    return this.attendanceService.getMonthlyReport(
      employeeId,
      Number(month) || m,
      Number(year) || y,
    );
  }

  @ApiOperation({ summary: 'Check-in (chấm công cho chính mình)' })
  @Post('check-in')
  checkIn(@Request() req: any, @Body() dto: { lat?: number; lng?: number }) {
    // employeeId lấy từ JWT — không nhận từ body để không chấm hộ người khác.
    // Server tự tính khoảng cách tới geofence từ lat/lng.
    const lat =
      dto?.lat === undefined || dto?.lat === null || (dto.lat as unknown) === ''
        ? undefined
        : Number(dto.lat);
    const lng =
      dto?.lng === undefined || dto?.lng === null || (dto.lng as unknown) === ''
        ? undefined
        : Number(dto.lng);
    return this.attendanceService.checkInForUser(req.user.sub, {
      lat,
      lng,
    });
  }

  @ApiOperation({ summary: 'Check-out (chấm công cho chính mình)' })
  @Post('check-out')
  checkOut(@Request() req: any) {
    return this.attendanceService.checkOutForUser(req.user.sub);
  }

  @ApiOperation({ summary: 'Cập nhật bản ghi chấm công thủ công (chỉ ADMIN)' })
  @UseGuards(RolesGuard)
  @Roles('ADMIN_GROUP')
  @Patch('record')
  upsertRecord(
    @Body()
    dto: {
      employeeId: string;
      date: string;
      status?: string;
      note?: string;
    },
  ) {
    return this.attendanceService.upsertRecord(
      dto.employeeId,
      new Date(dto.date),
      { status: dto.status, note: dto.note },
    );
  }
}