import { Controller, Get, Post, Patch, Param, Query, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { isAdminRole } from '@repo/shared-types';
import { EmployeesService } from './employees.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@ApiTags('Employees')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('employees')
export class EmployeesController {
  constructor(private employeesService: EmployeesService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Tạo nhân viên mới (tự sinh mã EMP####, gán onboarding tasks) — chỉ ADMIN vì tạo Employee = tạo User whitelist OAuth' })
  create(@Body() dto: CreateEmployeeDto) {
    return this.employeesService.create({
      ...dto,
      // joinDate nhận chuỗi "YYYY-MM-DD" từ client → convert sang Date
      joinDate: new Date(dto.joinDate),
      dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
    });
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Danh sách nhân viên (chỉ ADMIN)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'departmentId', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('departmentId') departmentId?: string,
    @Query('status') status?: string,
  ) {
    return this.employeesService.findAll({ page, limit, search, departmentId, status });
  }

  @Get('by-code/:code')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Lấy nhân viên theo employeeCode (chỉ ADMIN)' })
  findByCode(@Param('code') code: string) {
    return this.employeesService.findByCode(code);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết nhân viên (nhân viên chỉ xem hồ sơ của chính mình)' })
  findOne(@Param('id') id: string, @Request() req: any) {
    const isAdmin = isAdminRole(req.user?.role);
    return this.employeesService.findOne(
      id,
      isAdmin,
      isAdmin ? null : req.user?.sub,
    );
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN_GROUP')
  @ApiOperation({ summary: 'Cập nhật hồ sơ nhân viên (không gồm hợp đồng/lương) — chỉ ADMIN' })
  update(
    @Param('id') id: string,
    @Body()
    dto: {
      fullName?: string;
      phone?: string;
      address?: string;
      avatarUrl?: string;
      dateOfBirth?: string;
      nationalId?: string;
      gender?: string;
      status?: string;
    },
  ) {
    return this.employeesService.update(id, {
      ...dto,
      dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
    });
  }

  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles('ADMIN_GROUP')
  @ApiOperation({ summary: 'Đổi trạng thái làm việc (ACTIVE/PROBATION/ON_LEAVE/TERMINATED) — chỉ ADMIN' })
  updateStatus(@Param('id') id: string, @Body() dto: { status: string }) {
    return this.employeesService.update(id, { status: dto.status });
  }

  @Patch(':id/account')
  @UseGuards(RolesGuard)
  @Roles('ADMIN_GROUP')
  @ApiOperation({ summary: 'Cập nhật email/role tài khoản nhân viên (chỉ ADMIN) — email là whitelist OAuth GG/FB' })
  updateAccount(
    @Param('id') id: string,
    @Body() dto: UpdateAccountDto,
  ) {
    return this.employeesService.updateAccount(id, dto);
  }

  @Post(':id/reset-password')
  @UseGuards(RolesGuard)
  @Roles('ADMIN_GROUP')
  @ApiOperation({
    summary: 'Admin đặt lại mật khẩu nhân viên (chỉ EMPLOYEE active) — GENERATE trả plaintext 1 lần, thu hồi mọi phiên, ghi audit',
  })
  resetPassword(
    @Param('id') id: string,
    @Body() dto: ResetPasswordDto,
    @Request() req: { user?: { sub?: string; email?: string } },
  ) {
    return this.employeesService.resetPassword(
      id,
      dto,
      { id: req.user?.sub, email: req.user?.email },
    );
  }
}

