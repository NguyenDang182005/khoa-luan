import { Controller, Get, Post, Patch, Param, Body, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PayrollService } from './payroll.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PayrollMeQueryDto } from './dto/payroll-me-query.dto';
import { vnMonth } from '../common/vn-date';

@ApiTags('Payroll')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('payroll')
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  @ApiOperation({ summary: 'Lấy danh sách bảng lương theo tháng/năm (chỉ ADMIN)' })
  @UseGuards(RolesGuard)
  @Roles('ADMIN_GROUP')
  @Get()
  findAll(
    @Query('month') month: string,
    @Query('year') year: string,
  ) {
    const now = vnMonth();
    return this.payrollService.findAll(
      Number(month) || now.month,
      Number(year) || now.year,
    );
  }

  @ApiOperation({ summary: 'Bảng lương của tôi (mặc định tháng hiện tại giờ VN)' })
  @Get('me')
  me(@Request() req: any, @Query() query: PayrollMeQueryDto) {
    return this.payrollService.findMyPayroll(req.user.sub, query.month, query.year);
  }

  @ApiOperation({ summary: 'Lấy chi tiết một bản ghi lương (chỉ ADMIN)' })
  @UseGuards(RolesGuard)
  @Roles('ADMIN_GROUP')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.payrollService.findOne(id);
  }

  @ApiOperation({ summary: 'Lịch sử bảng lương mọi kỳ của một nhân viên (chỉ ADMIN)' })
  @UseGuards(RolesGuard)
  @Roles('ADMIN_GROUP')
  @Get('employee/:employeeId')
  historyByEmployee(@Param('employeeId') employeeId: string) {
    return this.payrollService.historyByEmployee(employeeId);
  }

  @ApiOperation({ summary: 'Preview tính lương một nhân viên (chưa lưu, chỉ ADMIN)' })
  @UseGuards(RolesGuard)
  @Roles('ADMIN_GROUP')
  @Get('preview/:employeeId')
  preview(
    @Param('employeeId') employeeId: string,
    @Query('month') month: string,
    @Query('year') year: string,
  ) {
    const now = vnMonth();
    return this.payrollService.calculatePayroll(
      employeeId,
      Number(month) || now.month,
      Number(year) || now.year,
    );
  }

  @ApiOperation({ summary: 'Tạo bảng lương cho một nhân viên (chỉ ADMIN)' })
  @UseGuards(RolesGuard)
  @Roles('ADMIN_GROUP')
  @Post('generate/:employeeId')
  generate(
    @Param('employeeId') employeeId: string,
    @Body() dto: { month: number; year: number },
  ) {
    return this.payrollService.generate(employeeId, dto.month, dto.year);
  }

  @ApiOperation({ summary: 'Tạo bảng lương hàng loạt cho toàn bộ nhân viên (chỉ ADMIN)' })
  @UseGuards(RolesGuard)
  @Roles('ADMIN_GROUP')
  @Post('generate-bulk')
  generateBulk(@Body() dto: { month: number; year: number }) {
    return this.payrollService.generateBulk(dto.month, dto.year);
  }

  @ApiOperation({ summary: 'Duyệt toàn bộ bảng lương DRAFT của kỳ (chỉ ADMIN)' })
  @UseGuards(RolesGuard)
  @Roles('ADMIN_GROUP')
  @Post('approve-bulk')
  approveBulk(@Body() dto: { month?: number; year?: number; ids?: string[] }) {
    return this.payrollService.approveBulk(dto);
  }

  @ApiOperation({ summary: 'Chi trả toàn bộ bảng lương APPROVED của kỳ (chỉ ADMIN)' })
  @UseGuards(RolesGuard)
  @Roles('ADMIN_GROUP')
  @Post('paid-bulk')
  markPaidBulk(@Body() dto: { month?: number; year?: number; ids?: string[] }) {
    return this.payrollService.markPaidBulk(dto);
  }

  @ApiOperation({ summary: 'Chỉnh thưởng / tạm ứng / ghi chú bảng lương nháp (chỉ ADMIN)' })
  @UseGuards(RolesGuard)
  @Roles('ADMIN_GROUP')
  @Patch(':id/adjust')
  adjust(
    @Param('id') id: string,
    @Body() dto: { bonus?: number; advance?: number; note?: string },
  ) {
    return this.payrollService.adjust(id, dto);
  }

  @ApiOperation({ summary: 'Phê duyệt bảng lương (chỉ ADMIN)' })
  @UseGuards(RolesGuard)
  @Roles('ADMIN_GROUP')
  @Patch(':id/approve')
  approve(@Param('id') id: string) {
    return this.payrollService.approve(id);
  }

  @ApiOperation({ summary: 'Đánh dấu đã thanh toán lương (chỉ ADMIN)' })
  @UseGuards(RolesGuard)
  @Roles('ADMIN_GROUP')
  @Patch(':id/paid')
  markAsPaid(@Param('id') id: string) {
    return this.payrollService.markAsPaid(id);
  }
}
