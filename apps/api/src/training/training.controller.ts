import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TrainingService } from './training.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

type TrainingScenario =
  | 'CUSTOMER_COMPLAINT'
  | 'COLLEAGUE_CONFLICT'
  | 'MANAGER_FEEDBACK'
  | 'NEW_EMPLOYEE_ONBOARDING'
  | 'PERFORMANCE_REVIEW'
  | 'GENERAL_COMMUNICATION';

@ApiTags('Training')
@Controller('training')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TrainingController {
  constructor(private readonly trainingService: TrainingService) {}

  // ── Legacy endpoints ─────────────────────────────────────────────────────────

  @Get('questions')
  @ApiOperation({ summary: 'Lấy danh sách câu hỏi hardcode theo scenario' })
  getQuestions(@Query('scenario') scenario?: TrainingScenario) {
    return this.trainingService.getQuestions(scenario);
  }

  @Get('my-sessions')
  @ApiOperation({ summary: 'Lịch sử bài test của chính nhân viên đang đăng nhập' })
  getMySessions(@Request() req: any) {
    return this.trainingService.getMySessions(req.user.sub);
  }

  @Post('sessions')
  @ApiOperation({ summary: 'Bắt đầu phiên training mới (cho chính mình)' })
  startSession(@Request() req: any, @Body() body: { scenario: TrainingScenario }) {
    return this.trainingService.startSession(req.user.sub, body.scenario);
  }

  @Post('sessions/:id/attempts')
  @ApiOperation({ summary: 'Nộp câu trả lời (hardcode questions)' })
  submitAttempt(
    @Request() req: any,
    @Param('id') sessionId: string,
    @Body() body: { questionId: string; answer: string },
  ) {
    return this.trainingService.submitAttempt(
      sessionId,
      body.questionId,
      body.answer,
      req.user.sub,
    );
  }

  @Get('analytics')
  @UseGuards(RolesGuard)
  @Roles('ADMIN_GROUP')
  @ApiOperation({ summary: 'Thống kê đào tạo theo tháng (Admin)' })
  getAnalytics(
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    return this.trainingService.getAnalytics(
      month ? parseInt(month) : undefined,
      year ? parseInt(year) : undefined,
    );
  }

  // ── Gemini-generated quiz flow ───────────────────────────────────────────────

  @Post('submit')
  @ApiOperation({
    summary: 'Nộp 7 câu trả lời (5 MCQ + 2 essay) — WF03 chấm điểm, lưu DB',
    description: `
Body: {
  scenarioType: "customer_complaint" | ...,
  answers: [
    { questionId: 1, question: "...", type: "mcq", answer: "B", correctAnswer: "B" },
    ...
    { questionId: 6, question: "...", type: "essay", answer: "Tôi sẽ..." }
  ]
}`,
  })
  submitQuiz(
    @Request() req: any,
    @Body()
    body: {
      scenarioType: string;
      answers: Array<{
        questionId: number;
        question: string;
        type: 'mcq' | 'essay';
        answer: string;
        correctAnswer?: string;
      }>;
    },
  ) {
    return this.trainingService.submitQuiz(req.user.sub, body.scenarioType, body.answers);
  }

  // ── Dashboard ────────────────────────────────────────────────────────────────

  @Get('dashboard/me')
  @ApiOperation({
    summary: 'Dashboard cá nhân — số bài đã làm, điểm TB/scenario, lịch sử 10 bài gần nhất',
  })
  getMyDashboard(@Request() req: any) {
    return this.trainingService.getMyDashboard(req.user.sub);
  }

  @Get('dashboard/overview')
  @UseGuards(RolesGuard)
  @Roles('ADMIN_GROUP')
  @ApiOperation({
    summary: 'Dashboard toàn công ty — danh sách NV, điểm TB, tỷ lệ hoàn thành/phòng ban (Admin)',
  })
  getOverviewDashboard() {
    return this.trainingService.getOverviewDashboard();
  }
}
