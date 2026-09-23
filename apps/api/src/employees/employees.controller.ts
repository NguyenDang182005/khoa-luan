import { Controller, Get, Post, Patch, Param, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { EmployeesService } from './employees.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateAccountDto } from './dto/update-account.dto';

@ApiTags('Employees')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('employees')
export class EmployeesController {
  constructor(private employeesService: EmployeesService) {}

  @Post()
  @ApiOperation({ summary: 'Tạo nhân viên mới (tự sinh mã EMP####, gán onboarding tasks)' })
  create(@Body() dto: CreateEmployeeDto) {
    return this.employeesService.create({
      ...dto,
      // joinDate nhận chuỗi "YYYY-MM-DD" từ client → convert sang Date
      joinDate: new Date(dto.joinDate),
      dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
    });
  }

  @Get()
  @ApiOperation({ summary: 'Danh sách nhân viên' })
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
  @ApiOperation({ summary: 'Lấy nhân viên theo employeeCode (EMP001...)' })
  findByCode(@Param('code') code: string) {
    return this.employeesService.findByCode(code);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết nhân viên' })
  findOne(@Param('id') id: string) {
    return this.employeesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật hồ sơ nhân viên (không gồm hợp đồng/lương)' })
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
  @ApiOperation({ summary: 'Đổi trạng thái làm việc (ACTIVE/PROBATION/ON_LEAVE/TERMINATED)' })
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
}

