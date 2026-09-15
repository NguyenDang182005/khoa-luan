import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TrainingService } from './training.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

type TrainingScenario = 'CUSTOMER_COMPLAINT' | 'COLLEAGUE_CONFLICT' | 'MANAGER_FEEDBACK' | 'NEW_EMPLOYEE_ONBOARDING' | 'PERFORMANCE_REVIEW' | 'GENERAL_COMMUNICATION';

@ApiTags('Training')
@Controller('training')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TrainingController {
  constructor(private readonly trainingService: TrainingService) {}

  @Get('questions')
  @ApiOperation({ summary: 'Lấy danh sách câu hỏi theo scenario' })
  getQuestions(@Query('scenario') scenario?: TrainingScenario) {
    return this.trainingService.getQuestions(scenario);
  }

  @Get('my-sessions')
  @ApiOperation({ summary: 'Lịch sử bài test của nhân viên' })
  getMySessions(@Query('employeeId') employeeId: string) {
    return this.trainingService.getMySessions(employeeId);
  }

  @Post('sessions')
  @ApiOperation({ summary: 'Bắt đầu phiên training mới' })
  startSession(@Body() body: { employeeId: string; scenario: TrainingScenario }) {
    return this.trainingService.startSession(body.employeeId, body.scenario);
  }

  @Post('sessions/:id/attempts')
  @ApiOperation({ summary: 'Nộp câu trả lời' })
  submitAttempt(
    @Param('id') sessionId: string,
    @Body() body: { questionId: string; answer: string },
  ) {
    return this.trainingService.submitAttempt(sessionId, body.questionId, body.answer);
  }

  @Patch('sessions/:id/grade')
  @ApiOperation({ summary: 'Lưu kết quả chấm điểm AI từ n8n WF03' })
  gradeSession(
    @Param('id') sessionId: string,
    @Body() body: { aiScore: Record<string, number>; aiFeedback: string },
  ) {
    return this.trainingService.gradeSession(sessionId, body.aiScore, body.aiFeedback);
  }

  @Get('analytics')
  @ApiOperation({ summary: 'Thống kê đào tạo tổng hợp (Admin)' })
  getAnalytics(
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    return this.trainingService.getAnalytics(
      month ? parseInt(month) : undefined,
      year ? parseInt(year) : undefined,
    );
  }
}
