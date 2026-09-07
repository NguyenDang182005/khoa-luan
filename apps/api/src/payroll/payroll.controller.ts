import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PayrollService } from './payroll.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Payroll')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('payroll')
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  @ApiOperation({ summary: 'Lấy danh sách bảng lương theo tháng/năm' })
  @Get()
  findAll(
    @Query('month') month: string,
    @Query('year') year: string,
  ) {
    return this.payrollService.findAll(Number(month), Number(year));
  }

  @ApiOperation({ summary: 'Lấy chi tiết một bản ghi lương' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.payrollService.findOne(id);
  }

  @ApiOperation({ summary: 'Preview tính lương một nhân viên (chưa lưu)' })
  @Get('preview/:employeeId')
  preview(
    @Param('employeeId') employeeId: string,
    @Query('month') month: string,
    @Query('year') year: string,
  ) {
    return this.payrollService.calculatePayroll(
      employeeId,
      Number(month),
      Number(year),
    );
  }

  @ApiOperation({ summary: 'Tạo bảng lương cho một nhân viên' })
  @Post('generate/:employeeId')
  generate(
    @Param('employeeId') employeeId: string,
    @Body() dto: { month: number; year: number },
  ) {
    return this.payrollService.generate(employeeId, dto.month, dto.year);
  }

  @ApiOperation({ summary: 'Tạo bảng lương hàng loạt cho toàn bộ nhân viên' })
  @Post('generate-bulk')
  generateBulk(@Body() dto: { month: number; year: number }) {
    return this.payrollService.generateBulk(dto.month, dto.year);
  }

  @ApiOperation({ summary: 'Phê duyệt bảng lương' })
  @Patch(':id/approve')
  approve(@Param('id') id: string) {
    return this.payrollService.approve(id);
  }

  @ApiOperation({ summary: 'Đánh dấu đã thanh toán lương' })
  @Patch(':id/paid')
  markAsPaid(@Param('id') id: string) {
    return this.payrollService.markAsPaid(id);
  }
}
