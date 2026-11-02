import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AgentsService } from './agents.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Agents')
@Controller('agents')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN_GROUP')
@ApiBearerAuth()
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Get('performance')
  @ApiOperation({ summary: 'Performance metrics của 4 AI Agents từ DB' })
  getPerformance() {
    return this.agentsService.getPerformance();
  }
}
