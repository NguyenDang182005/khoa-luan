import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  Request,
  UseGuards,
  HttpCode,
  HttpStatus,
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
 * Chat/session của nhân viên (chat, chat-session/latest, renew, onboarding/my) mở cho mọi
 * người đã đăng nhập — dùng chính hồ sơ trong JWT.
 * Các route quản trị (thống kê, hội thoại, escalate, PII audit) có RolesGuard + @Roles('ADMIN_GROUP').
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
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Chat với AI Agent (server-side gọi n8n WF01, gắn session)' })
  chat(@Request() req: any, @Body() dto: AgentChatDto) {
    return this.agentsService.portalChat(
      req.user.sub,
      dto.message,
      dto.sessionId,
      dto.sessionType,
      dto.scenarioType,
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
    // Q7-day: chỉ trả phiên còn "rehydratable" (active + cùng ngày VN) —
    // tránh UI luôn kéo đoạn chat cũ của những ngày trước vào tab chat.
    return this.aiContextService.getRehydratableWebSession(employee.id, type);
  }

  private async renewSessionFor(req: any, type: string) {
    const employee = await this.agentsService.resolveEmployee(req.user.sub);
    return this.aiContextService.renewWebSession(employee.id, type);
  }

    @Get('intent-stats')
  @UseGuards(RolesGuard)
  @Roles('ADMIN_GROUP')
  @ApiOperation({ summary: 'Thống kê intent Router Agent định tuyến' })
  intentStats() {
    return this.agentsService.getIntentStats();
  }

  @Get('conversations')
  @UseGuards(RolesGuard)
  @Roles('ADMIN_GROUP')
  @ApiOperation({ summary: 'Tất cả hội thoại CSKH (đang bot + đã escalate)' })
  conversations() {
    return this.aiContextService.getConversations();
  }

  @Get('escalation-queue')
  @UseGuards(RolesGuard)
  @Roles('ADMIN_GROUP')
  @ApiOperation({ summary: 'Hàng đợi CSKH cần xử lý thủ công (Specialist / Employee)' })
  escalationQueue() {
    return this.aiContextService.getEscalationQueue();
  }

  @Get('chat-history/:sessionId')
  @UseGuards(RolesGuard)
  @Roles('ADMIN_GROUP')
  @ApiOperation({ summary: 'Lịch sử hội thoại của một session' })
  async chatHistory(@Param('sessionId') sessionId: string) {
    const messages = await this.aiContextService.getSessionHistory(sessionId);
    return { messages };
  }

  @Post('chat-session/:id/reactivate')
  @UseGuards(RolesGuard)
  @Roles('ADMIN_GROUP')
  @ApiOperation({ summary: 'Bật lại bot cho session (hoàn thành hỗ trợ)' })
  reactivateSession(@Param('id') id: string) {
    return this.aiContextService.reactivateSession(id);
  }

  @Post('chat-session/:id/deactivate')
  @UseGuards(RolesGuard)
  @Roles('ADMIN_GROUP')
  @ApiOperation({ summary: 'Tắt bot cho session (tiếp quản thủ công)' })
  deactivateSession(@Param('id') id: string) {
    return this.aiContextService.deactivateSession(id);
  }

  @Post('chat-session/:id/reply')
  @UseGuards(RolesGuard)
  @Roles('ADMIN_GROUP')
  @ApiOperation({ summary: 'Nhân viên phản hồi thủ công vào session (human takeover)' })
  reply(@Param('id') id: string, @Body() dto: AgentReplyDto) {
    return this.agentsService.replyToSession(id, dto.content);
  }

  @Get('pii-audit')
  @UseGuards(RolesGuard)
  @Roles('ADMIN_GROUP')
  @ApiOperation({ summary: 'Audit PII: message AI gần nhất kèm session' })
  piiAudit(@Query() query: PiiAuditQueryDto) {
    return this.agentsService.getPiiAudit(query.limit ?? 20);
  }

  @Get('onboarding/my')
  @ApiOperation({ summary: 'Onboarding tasks của nhân viên đang đăng nhập' })
  myOnboarding(@Request() req: any) {
    return this.agentsService.getMyOnboarding(req.user.sub);
  }
}
