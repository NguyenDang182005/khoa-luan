import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { LeaveService } from './leave.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Leave')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('leave')
export class LeaveController {
  constructor(private readonly leaveService: LeaveService) {}

  @ApiOperation({ summary: 'Danh sách đơn nghỉ phép' })
  @Get()
  findAll(
    @Query('status') status?: string,
    @Query('employeeId') employeeId?: string,
  ) {
    return this.leaveService.findAll({ status, employeeId });
  }

  @ApiOperation({ summary: 'Chi tiết đơn nghỉ phép' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.leaveService.findOne(id);
  }

  @ApiOperation({ summary: 'Số ngày phép còn lại' })
  @Get('balance/:employeeId')
  getBalance(
    @Param('employeeId') employeeId: string,
    @Query('year') year: string,
  ) {
    return this.leaveService.getBalance(
      employeeId,
      year ? Number(year) : new Date().getFullYear(),
    );
  }

  @ApiOperation({ summary: 'Tạo đơn nghỉ phép' })
  @Post()
  create(
    @Body()
    dto: {
      employeeId: string;
      type: string;
      startDate: string;
      endDate: string;
      reason: string;
    },
  ) {
    return this.leaveService.create({
      ...dto,
      startDate: new Date(dto.startDate),
      endDate: new Date(dto.endDate),
    });
  }

  @ApiOperation({ summary: 'Phê duyệt đơn nghỉ phép' })
  @Patch(':id/approve')
  approve(
    @Param('id') id: string,
    @Body() dto: { approverId: string },
  ) {
    return this.leaveService.approve(id, dto.approverId);
  }

  @ApiOperation({ summary: 'Từ chối đơn nghỉ phép' })
  @Patch(':id/reject')
  reject(
    @Param('id') id: string,
    @Body() dto: { approverId: string; rejectionReason: string },
  ) {
    return this.leaveService.reject(id, dto.approverId, dto.rejectionReason);
  }

  @ApiOperation({ summary: 'Hủy đơn nghỉ phép' })
  @Patch(':id/cancel')
  cancel(
    @Param('id') id: string,
    @Body() dto: { employeeId: string },
  ) {
    return this.leaveService.cancel(id, dto.employeeId);
  }
}
