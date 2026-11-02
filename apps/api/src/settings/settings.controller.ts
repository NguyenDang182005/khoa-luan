import {
  Controller,
  Get,
  Patch,
  Delete,
  Post,
  Body,
  UseGuards,
  Request,
  Query,
  Param,
  DefaultValuePipe,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { SettingsService } from './settings.service';
import { UpdateLeavePolicyDto } from './dto/update-leave-policy.dto';
import { UpdateSecurityPolicyDto } from './dto/update-security-policy.dto';
import { UpdateAiAgentConfigDto } from './dto/update-ai-agent-config.dto';

@ApiTags('Settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('settings')
export class SettingsController {
  constructor(private readonly service: SettingsService) {}

  @ApiOperation({ summary: 'Vùng địa lý chấm công (mọi user — check-in cần)' })
  @Get('geofence')
  getGeofence() {
    return this.service.getGeofence();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_GROUP')
  @ApiOperation({ summary: 'Cập nhật vùng địa lý chấm công — ghi audit log (Admin)' })
  @Patch('geofence')
  updateGeofence(
    @Request() req: { user: { sub: string; email: string } },
    @Body() dto: { name?: string; lat?: number; lng?: number; radiusM?: number },
  ) {
    return this.service.updateGeofence(dto, { id: req.user?.sub, email: req.user?.email });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_GROUP')
  @ApiOperation({ summary: 'Ping trạng thái tích hợp: DB / n8n / Slack / Gemini (Admin)' })
  @Get('integrations')
  getIntegrations() {
    return this.service.getIntegrations();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_GROUP')
  @ApiOperation({ summary: 'Chính sách phép năm (Admin)' })
  @Get('leave-policy')
  getLeavePolicy() {
    return this.service.getLeavePolicy();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_GROUP')
  @ApiOperation({ summary: 'Cập nhật chính sách phép năm — ghi audit log (Admin)' })
  @Patch('leave-policy')
  updateLeavePolicy(@Request() req: { user: { sub: string; email: string } }, @Body() dto: UpdateLeavePolicyDto) {
    return this.service.updateLeavePolicy(
      dto,
      { id: req.user?.sub, email: req.user?.email },
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_GROUP')
  @ApiOperation({ summary: 'Chính sách bảo mật (Admin)' })
  @Get('security-policy')
  getSecurityPolicy() {
    return this.service.getSecurityPolicy();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_GROUP')
  @ApiOperation({ summary: 'Cập nhật chính sách bảo mật — ghi audit log (Admin)' })
  @Patch('security-policy')
  updateSecurityPolicy(@Request() req: { user: { sub: string; email: string } }, @Body() dto: UpdateSecurityPolicyDto) {
    return this.service.updateSecurityPolicy(
      dto,
      { id: req.user?.sub, email: req.user?.email },
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_GROUP')
  @ApiOperation({ summary: 'Danh sách phiên đăng nhập active (Admin)' })
  @Get('sessions')
  getSessions() {
    return this.service.getActiveSessions();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_GROUP')
  @ApiOperation({ summary: 'Thu hồi 1 phiên đăng nhập (Admin)' })
  @Delete('sessions/:id')
  revokeSession(@Param('id') id: string) {
    return this.service.revokeSession(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_GROUP')
  @ApiOperation({ summary: 'Thu hồi mọi phiên khác của tôi (giữ phiên hiện tại)' })
  @Post('sessions/revoke-others')
  @HttpCode(HttpStatus.OK)
  revokeOtherSessions(@Request() req: { user: { sub: string; sid?: string } }) {
    return this.service.revokeOtherSessions(req.user?.sub, req.user?.sid);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_GROUP')
  @ApiOperation({ summary: 'Lịch sử đăng nhập gần nhất (Admin)' })
  @Get('login-history')
  getLoginHistory(
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.service.getLoginHistory(limit);
  }

  // ── AI Agent ──

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_GROUP')
  @ApiOperation({ summary: 'Cấu hình AI Agent (Admin) — GET không trả apiKey' })
  @Get('ai-config')
  getAiConfig() {
    return this.service.getAiConfig();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_GROUP')
  @ApiOperation({ summary: 'Cập nhật cấu hình AI Agent — ghi audit log, apiKey được che (Admin)' })
  @Patch('ai-config')
  updateAiConfig(@Request() req: { user: { sub: string; email: string } }, @Body() dto: UpdateAiAgentConfigDto) {
    return this.service.updateAiConfig(dto, { id: req.user?.sub, email: req.user?.email });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_GROUP')
  @ApiOperation({ summary: 'Kiểm tra kết nối n8n: ping /healthz + 1 tin nhắn round-trip (Admin)' })
  @Post('ai/test-connection')
  @HttpCode(HttpStatus.OK)
  testAiConnection(@Request() req: { user: { sub: string } }) {
    return this.service.testAiConnection(req.user?.sub);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_GROUP')
  @ApiOperation({ summary: 'Danh sách ngày lễ quốc gia của một năm (Admin)' })
  @Get('holidays')
  getHolidays(@Query('year') year?: string) {
    return this.service.getHolidays(year ? Number(year) : undefined);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_GROUP')
  @ApiOperation({ summary: 'Thêm ngày lễ quốc gia — ảnh hưởng tính công/phép/OT (Admin)' })
  @Post('holidays')
  createHoliday(
    @Request() req: { user: { sub: string; email: string } },
    @Body() dto: { date: string; name: string },
  ) {
    return this.service.createHoliday(dto, {
      id: req.user?.sub,
      email: req.user?.email,
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_GROUP')
  @ApiOperation({ summary: 'Xóa ngày lễ (Admin)' })
  @Delete('holidays/:id')
  deleteHoliday(
    @Param('id') id: string,
    @Request() req: { user: { sub: string; email: string } },
  ) {
    return this.service.deleteHoliday(id, {
      id: req.user?.sub,
      email: req.user?.email,
    });
  }

  // ── Nhật ký thay đổi cài đặt ──

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_GROUP')
  @ApiOperation({ summary: 'Nhật ký thay đổi cài đặt, phân trang + lọc theo mục (Admin)' })
  @Get('audit-log')
  getAuditLog(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('section') section?: string,
  ) {
    return this.service.getAuditLog({ page, limit, section });
  }
}
