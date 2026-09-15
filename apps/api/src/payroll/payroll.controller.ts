import { Controller, Get, Post, Patch, Param, Body, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PayrollService } from './payroll.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PayrollMeQueryDto } from './dto/payroll-me-query.dto';

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
    const now = new Date();
    return this.payrollService.findAll(
      Number(month) || now.getMonth() + 1,
      Number(year) || now.getFullYear(),
    );
  }

  @ApiOperation({ summary: 'Bảng lương của tôi (mặc định tháng hiện tại giờ VN)' })
  @Get('me')
  me(@Request() req: any, @Query() query: PayrollMeQueryDto) {
    return this.payrollService.findMyPayroll(req.user.sub, query.month, query.year);
  }

  @ApiOperation({ summary: 'Lấy chi tiết một bản ghi lương' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.payrollService.findOne(id);
  }

  @ApiOperation({ summary: 'Lịch sử bảng lương mọi kỳ của một nhân viên' })
  @Get('employee/:employeeId')
  historyByEmployee(@Param('employeeId') employeeId: string) {
    return this.payrollService.historyByEmployee(employeeId);
  }

  @ApiOperation({ summary: 'Preview tính lương một nhân viên (chưa lưu)' })
  @Get('preview/:employeeId')
  preview(
    @Param('employeeId') employeeId: string,
    @Query('month') month: string,
    @Query('year') year: string,
  ) {
    const now = new Date();
    return this.payrollService.calculatePayroll(
      employeeId,
      Number(month) || now.getMonth() + 1,
      Number(year) || now.getFullYear(),
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

  @ApiOperation({ summary: 'Duyệt toàn bộ bảng lương DRAFT của kỳ (hoặc theo ids đã chọn)' })
  @Post('approve-bulk')
  approveBulk(@Body() dto: { month?: number; year?: number; ids?: string[] }) {
    return this.payrollService.approveBulk(dto);
  }

  @ApiOperation({ summary: 'Chi trả toàn bộ bảng lương APPROVED của kỳ (hoặc theo ids đã chọn)' })
  @Post('paid-bulk')
  markPaidBulk(@Body() dto: { month?: number; year?: number; ids?: string[] }) {
    return this.payrollService.markPaidBulk(dto);
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
