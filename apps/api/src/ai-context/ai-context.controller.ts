import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiSecurity } from '@nestjs/swagger';
import { AiContextService, ApiKeyGuard } from './ai-context.service';
import { vnMonth } from '../common/vn-date';

@ApiTags('AI Context (n8n)')
@ApiSecurity('x-api-key')
@UseGuards(ApiKeyGuard)
@Controller('n8n')
export class AiContextController {
  constructor(private readonly service: AiContextService) {}

  @ApiOperation({ summary: 'Lấy context nhân viên để inject vào LLM prompt' })
  @Get('employee-context/:employeeId')
  getEmployeeContext(@Param('employeeId') employeeId: string) {
    return this.service.getEmployeeContext(employeeId);
  }

  @ApiOperation({ summary: 'Lấy context lương để inject vào LLM prompt' })
  @Get('payroll-context/:employeeId')
  getPayrollContext(
    @Param('employeeId') employeeId: string,
    @Query('month') month: string,
    @Query('year') year: string,
  ) {
    const { year: y, month: m } = vnMonth();
    return this.service.getPayrollContext(
      employeeId,
      Number(month) || m,
      Number(year) || y,
    );
  }

  @ApiOperation({ summary: 'Tạo hoặc lấy session chat AI (kèm messages[])' })
  @Post('chat/session')
  createOrGetSession(
    @Body()
    dto: {
      sessionId?: string;
      employeeId?: string;
      type: string;
      channel: string;
      externalId?: string;
    },
  ) {
    return this.service.createOrGetSession(dto);
  }

  @ApiOperation({ summary: 'Lưu message vào DB (n8n gọi sau mỗi lượt)' })
  @Post('chat/message')
  saveMessage(
    @Body()
    dto: {
      sessionId: string;
      role: string;
      content: string;
      metadata?: object;
    },
  ) {
    return this.service.saveMessage(dto);
  }

  @ApiOperation({ summary: 'Lấy lịch sử hội thoại của session' })
  @Get('chat/history/:sessionId')
  getHistory(@Param('sessionId') sessionId: string) {
    return this.service.getSessionHistory(sessionId);
  }

  /**
   * Q2 — Human-in-the-loop escalation.
   * n8n gọi endpoint này khi CSKH Agent phát hiện khiếu nại vượt thẩm quyền.
   * Lưu notification vào DB, Gateway sẽ emit WebSocket đến room 'admin'
   * để Web Portal Admin nhận cảnh báo real-time.
   */
  @ApiOperation({ summary: 'Escalate hội thoại CSKH lên Admin (Human-in-the-loop)' })
  @Post('escalate')
  async escalate(
    @Body()
    dto: {
      sessionId: string;
      userId: string;
      channel: string;
      lastMessage: string;
      reason: string;
    },
  ) {
    return this.service.escalateToHuman(dto);
  }

  @ApiOperation({ summary: 'Kích hoạt lại bot cho session (Admin hoàn thành hỗ trợ)' })
  @Post('chat/session/:sessionId/reactivate')
  reactivateSession(@Param('sessionId') sessionId: string) {
    return this.service.reactivateSession(sessionId);
  }

  /** n8n WF04 gọi sau khi AI soạn xong câu trả lời — NestJS chịu trách nhiệm
   *  gửi ra kênh khách hàng (channel mode với thread reply trong demo Slack). */
  @ApiOperation({ summary: 'Gửi câu trả lời AI ra kênh khách hàng (Slack channel thread)' })
  @Post('outbound-reply')
  outboundReply(
    @Body()
    dto: {
      sessionId?: string;
      externalId?: string;
      slackChannel?: string; // Slack channel ID (C...) — channel mode
      threadTs?: string;     // thread_ts để reply trong đúng thread
      content: string;
    },
  ) {
    return this.service.deliverOutboundReply(dto);
  }
}
