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
    return this.service.getPayrollContext(
      employeeId,
      Number(month),
      Number(year),
    );
  }

  @ApiOperation({ summary: 'Tạo hoặc lấy session chat AI (kèm messages[])' })
  @Post('chat/session')
  createOrGetSession(
    @Body()
    dto: {
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
}
