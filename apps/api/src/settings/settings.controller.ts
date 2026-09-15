import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { SettingsService } from './settings.service';

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
  @ApiOperation({ summary: 'Cập nhật vùng địa lý chấm công (Admin)' })
  @Patch('geofence')
  updateGeofence(@Body() dto: { name?: string; lat?: number; lng?: number; radiusM?: number }) {
    return this.service.updateGeofence(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_GROUP')
  @ApiOperation({ summary: 'Ping trạng thái tích hợp: DB / n8n / Slack / Gemini (Admin)' })
  @Get('integrations')
  getIntegrations() {
    return this.service.getIntegrations();
  }
}
