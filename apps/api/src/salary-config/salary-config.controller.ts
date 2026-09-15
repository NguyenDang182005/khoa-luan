import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SalaryConfigService } from './salary-config.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Salary Config')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('salary-config')
export class SalaryConfigController {
  constructor(private readonly service: SalaryConfigService) {}

  @ApiOperation({ summary: 'Lấy cấu hình lương hiện tại' })
  @Get('current')
  getCurrent() {
    return this.service.getCurrent();
  }

  @ApiOperation({ summary: 'Danh sách cấu hình lương theo năm' })
  @Get()
  findAll() {
    return this.service.findAll();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_GROUP')
  @ApiOperation({ summary: 'Tạo/cập nhật cấu hình lương theo năm (Admin)' })
  @Post()
  upsert(@Body() dto: any) {
    return this.service.upsert(dto);
  }
}
