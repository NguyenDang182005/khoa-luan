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

@ApiTags('Attendance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @ApiOperation({ summary: 'Danh sách chấm công theo tháng (HR)' })
  @Get()
  findAll(@Query('month') month: string, @Query('year') year: string) {
    const now = new Date();
    return this.attendanceService.findAll(
      Number(month) || now.getMonth() + 1,
      Number(year) || now.getFullYear(),
    );
  }

  @ApiOperation({ summary: 'Chấm công theo tháng của nhân viên' })
  @Get('employee/:employeeId')
  findByEmployee(
    @Param('employeeId') employeeId: string,
    @Query('month') month: string,
    @Query('year') year: string,
  ) {
    const now = new Date();
    return this.attendanceService.findByEmployee(
      employeeId,
      Number(month) || now.getMonth() + 1,
      Number(year) || now.getFullYear(),
    );
  }

  @ApiOperation({ summary: 'Báo cáo tổng hợp chấm công tháng' })
  @Get('report/:employeeId')
  getMonthlyReport(
    @Param('employeeId') employeeId: string,
    @Query('month') month: string,
    @Query('year') year: string,
  ) {
    const now = new Date();
    return this.attendanceService.getMonthlyReport(
      employeeId,
      Number(month) || now.getMonth() + 1,
      Number(year) || now.getFullYear(),
    );
  }

  @ApiOperation({ summary: 'Check-in' })
  @Post('check-in')
  checkIn(
    @Body() dto: { employeeId: string; location?: string },
  ) {
    return this.attendanceService.checkIn(dto.employeeId, dto.location);
  }

  @ApiOperation({ summary: 'Check-out' })
  @Post('check-out')
  checkOut(@Body() dto: { employeeId: string }) {
    return this.attendanceService.checkOut(dto.employeeId);
  }

  @ApiOperation({ summary: 'Cập nhật bản ghi chấm công thủ công (HR)' })
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
