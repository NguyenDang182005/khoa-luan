import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AgentsService } from './agents.service';
import { AiContextService } from '../ai-context/ai-context.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AgentChatDto, SessionTypeDto } from './dto/agent-chat.dto';
import { AgentReplyDto } from './dto/agent-reply.dto';
import { PiiAuditQueryDto } from './dto/pii-audit-query.dto';

/**
 * Endpoints cho Web Portal — xác thực bằng JWT (browser KHÔNG gọi n8n trực tiếp).
 * Route chỉ dành cho nhóm Admin (ADMIN / HR_MANAGER / HR_ADMIN) được bảo vệ thêm
 * bởi RolesGuard + @Roles('ADMIN_GROUP').
 */
@ApiTags('Agents (Portal)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('agents')
export class PortalAgentsController {
  constructor(
    private readonly agentsService: AgentsService,
    private readonly aiContextService: AiContextService,
  ) {}

  @Post('chat')
  @ApiOperation({ summary: 'Chat với AI Agent (server-side gọi n8n WF01, gắn session)' })
  chat(@Request() req: any, @Body() dto: AgentChatDto) {
    return this.agentsService.portalChat(
      req.user.sub,
      dto.message,
      dto.sessionId,
      dto.sessionType,
    );
  }

  @Get('chat-session/latest/:type')
  @ApiOperation({
    summary: 'Q16 — Phiên chat web gần nhất của nhân viên theo loại (kèm messages)',
  })
  latestSession(@Request() req: any, @Param('type') type: string) {
    return this.latestSessionFor(req, type);
  }

  @Post('chat-session/renew')
  @ApiOperation({ summary: 'Q19 — "Phiên mới": đóng phiên web hiện tại, mở phiên mới' })
  renewSession(@Request() req: any, @Body() dto: SessionTypeDto) {
    return this.renewSessionFor(req, dto.type);
  }

  /** Resolve employee từ JWT — dùng cho 2 endpoint session phía trên */
  private async latestSessionFor(req: any, type: string) {
    const employee = await this.agentsService.resolveEmployee(req.user.sub);
    return this.aiContextService.getLatestWebSession(employee.id, type);
  }

  private async renewSessionFor(req: any, type: string) {
    const employee = await this.agentsService.resolveEmployee(req.user.sub);
    return this.aiContextService.renewWebSession(employee.id, type);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_GROUP')
  @Get('intent-stats')
  @ApiOperation({ summary: 'Thống kê intent Router Agent định tuyến (Admin)' })
  intentStats() {
    return this.agentsService.getIntentStats();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_GROUP')
  @Get('conversations')
  @ApiOperation({ summary: 'Tất cả hội thoại CSKH (đang bot + đã escalate) (Admin)' })
  conversations() {
    return this.aiContextService.getConversations();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_GROUP')
  @Get('escalation-queue')
  @ApiOperation({ summary: 'Hàng đợi CSKH cần xử lý thủ công (Admin)' })
  escalationQueue() {
    return this.aiContextService.getEscalationQueue();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_GROUP')
  @Get('chat-history/:sessionId')
  @ApiOperation({ summary: 'Lịch sử hội thoại của một session (Admin)' })
  async chatHistory(@Param('sessionId') sessionId: string) {
    const messages = await this.aiContextService.getSessionHistory(sessionId);
    return { messages };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_GROUP')
  @Post('chat-session/:id/reactivate')
  @ApiOperation({ summary: 'Bật lại bot cho session (Admin hoàn thành hỗ trợ)' })
  reactivateSession(@Param('id') id: string) {
    return this.aiContextService.reactivateSession(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_GROUP')
  @Post('chat-session/:id/deactivate')
  @ApiOperation({ summary: 'Tắt bot cho session (Admin tiếp quản thủ công)' })
  deactivateSession(@Param('id') id: string) {
    return this.aiContextService.deactivateSession(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_GROUP')
  @Post('chat-session/:id/reply')
  @ApiOperation({ summary: 'Nhân viên phản hồi thủ công vào session (human takeover)' })
  reply(@Param('id') id: string, @Body() dto: AgentReplyDto) {
    return this.agentsService.replyToSession(id, dto.content);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_GROUP')
  @Get('pii-audit')
  @ApiOperation({ summary: 'Audit PII: message AI gần nhất kèm session (Admin)' })
  piiAudit(@Query() query: PiiAuditQueryDto) {
    return this.agentsService.getPiiAudit(query.limit ?? 20);
  }

  @Get('onboarding/my')
  @ApiOperation({ summary: 'Onboarding tasks của nhân viên đang đăng nhập' })
  myOnboarding(@Request() req: any) {
    return this.agentsService.getMyOnboarding(req.user.sub);
  }
}
