import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiSecurity } from '@nestjs/swagger';
import { NotificationsService, NotificationsGateway } from './notifications.gateway';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiKeyGuard } from '../ai-context/ai-context.service';

@ApiTags('Notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly gateway: NotificationsGateway,
  ) {}

  @ApiOperation({ summary: 'Lấy thông báo của user hiện tại' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('my')
  getMyNotifications(@Request() req: any) {
    return this.notificationsService.findByUser(req.user.sub);
  }

  @ApiOperation({ summary: 'Đánh dấu đã đọc một thông báo' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch(':id/read')
  markAsRead(@Param('id') id: string) {
    return this.notificationsService.markAsRead(id);
  }

  @ApiOperation({ summary: 'Đánh dấu tất cả thông báo đã đọc' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch('read-all')
  markAllRead(@Request() req: any) {
    return this.notificationsService.markAllRead(req.user.sub);
  }

  /** Called by n8n to push a notification to a specific user */
  @ApiOperation({ summary: '[n8n] Push notification cho user' })
  @ApiSecurity('x-api-key')
  @UseGuards(ApiKeyGuard)
  @Post('send')
  send(
    @Body()
    dto: {
      userId: string;
      type: string;
      title: string;
      body: string;
      data?: object;
    },
  ) {
    return this.notificationsService.createAndSend(
      this.gateway,
      dto.userId,
      dto,
    );
  }
}
