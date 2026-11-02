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
import { LeaveService } from './leave.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { isAdminRole } from '@repo/shared-types';
import { vnMonth } from '../common/vn-date';

@ApiTags('Leave')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('leave')
export class LeaveController {
  constructor(private readonly leaveService: LeaveService) {}

  @ApiOperation({
    summary: 'Danh sách đơn nghỉ phép (ADMIN xem tất cả, nhân viên chỉ xem của mình)',
  })
  @Get()
  findAll(
    @Request() req: any,
    @Query('status') status?: string,
    @Query('employeeId') employeeId?: string,
  ) {
    // Nhân viên chỉ được lọc theo chính mình — không truyền employeeId của người khác.
    const own = isAdminRole(req.user.role) ? null : req.user.sub;
    return this.leaveService.findAll({ status, employeeId, ownUserId: own });
  }

  @ApiOperation({ summary: 'Chi tiết đơn nghỉ phép (chỉ chủ đơn hoặc ADMIN)' })
  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: any) {
    const viewer = isAdminRole(req.user.role) ? null : req.user.sub;
    return this.leaveService.findOne(id, viewer);
  }

  @ApiOperation({ summary: 'Số ngày phép còn lại (chỉ chủ hồ sơ hoặc ADMIN)' })
  @Get('balance/:employeeId')
  getBalance(
    @Param('employeeId') employeeId: string,
    @Query('year') year: string,
    @Request() req: any,
  ) {
    const viewer = isAdminRole(req.user.role) ? null : req.user.sub;
    return this.leaveService.getBalance(
      employeeId,
      year ? Number(year) : vnMonth().year,
      viewer,
    );
  }

  @ApiOperation({ summary: 'Tạo đơn nghỉ phép' })
  @Post()
  create(
    @Request() req: any,
    @Body()
    dto: {
      employeeId: string;
      type: string;
      startDate: string;
      endDate: string;
      reason: string;
      overtimeHours?: number;
      overtimeDate?: string;
    },
  ) {
    return this.leaveService.create({
      ...dto,
      startDate: new Date(dto.startDate),
      endDate: new Date(dto.endDate),
      overtimeDate: dto.overtimeDate ? new Date(dto.overtimeDate) : undefined,
    }, isAdminRole(req.user.role) ? null : req.user.sub);
  }

  @ApiOperation({ summary: 'Phê duyệt đơn nghỉ phép (chỉ ADMIN)' })
  @UseGuards(RolesGuard)
  @Roles('ADMIN_GROUP')
  @Patch(':id/approve')
  approve(@Param('id') id: string, @Request() req: any) {
    // approverId lấy từ JWT — không nhận từ body để không tự duyệt đơn của mình.
    return this.leaveService.approve(id, req.user.sub);
  }

  @ApiOperation({ summary: 'Từ chối đơn nghỉ phép (chỉ ADMIN)' })
  @UseGuards(RolesGuard)
  @Roles('ADMIN_GROUP')
  @Patch(':id/reject')
  reject(
    @Param('id') id: string,
    @Body() dto: { rejectionReason: string },
    @Request() req: any,
  ) {
    return this.leaveService.reject(id, req.user.sub, dto.rejectionReason);
  }

  @ApiOperation({ summary: 'Hủy đơn nghỉ phép (chỉ chủ đơn)' })
  @Patch(':id/cancel')
  cancel(@Param('id') id: string, @Request() req: any) {
    return this.leaveService.cancel(id, req.user.sub);
  }
}