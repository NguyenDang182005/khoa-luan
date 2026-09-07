import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OnboardingService } from './onboarding.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Onboarding')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly service: OnboardingService) {}

  // ── Tasks ──────────────────────────────────────────────────────────────

  @ApiOperation({ summary: 'Danh sách task template' })
  @Get('tasks')
  findAllTasks() {
    return this.service.findAllTasks();
  }

  @ApiOperation({ summary: 'Tạo task template' })
  @Post('tasks')
  createTask(@Body() dto: any) {
    return this.service.createTask(dto);
  }

  @ApiOperation({ summary: 'Cập nhật task template' })
  @Patch('tasks/:id')
  updateTask(@Param('id') id: string, @Body() dto: any) {
    return this.service.updateTask(id, dto);
  }

  @ApiOperation({ summary: 'Xóa task template' })
  @Delete('tasks/:id')
  deleteTask(@Param('id') id: string) {
    return this.service.deleteTask(id);
  }

  // ── Progress ───────────────────────────────────────────────────────────

  @ApiOperation({ summary: 'Tổng hợp tiến độ onboarding tất cả nhân viên' })
  @Get('progress')
  getAllProgress() {
    return this.service.getAllProgress();
  }

  @ApiOperation({ summary: 'Tiến độ onboarding của nhân viên' })
  @Get('progress/:employeeId')
  getEmployeeProgress(@Param('employeeId') employeeId: string) {
    return this.service.getProgressSummary(employeeId);
  }

  @ApiOperation({ summary: 'Cập nhật trạng thái task onboarding' })
  @Patch('progress/:employeeId/:taskId')
  updateProgress(
    @Param('employeeId') employeeId: string,
    @Param('taskId') taskId: string,
    @Body() dto: { status: string; note?: string },
  ) {
    return this.service.updateProgress(employeeId, taskId, dto);
  }

  @ApiOperation({ summary: 'Gán tất cả task onboarding cho nhân viên mới' })
  @Post('assign/:employeeId')
  assignTasks(@Param('employeeId') employeeId: string) {
    return this.service.assignTasksToEmployee(employeeId);
  }
}
