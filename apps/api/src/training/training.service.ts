import { BadGatewayException, Injectable, NotFoundException, Request } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

type TrainingScenario =
  | 'CUSTOMER_COMPLAINT'
  | 'COLLEAGUE_CONFLICT'
  | 'MANAGER_FEEDBACK'
  | 'NEW_EMPLOYEE_ONBOARDING'
  | 'PERFORMANCE_REVIEW'
  | 'GENERAL_COMMUNICATION';

const SCENARIO_MAP: Record<string, TrainingScenario> = {
  customer_complaint: 'CUSTOMER_COMPLAINT',
  colleague_conflict: 'COLLEAGUE_CONFLICT',
  manager_feedback: 'MANAGER_FEEDBACK',
  new_employee_onboarding: 'NEW_EMPLOYEE_ONBOARDING',
  performance_review: 'PERFORMANCE_REVIEW',
  general_communication: 'GENERAL_COMMUNICATION',
};

const N8N_QUIZ_TIMEOUT_MS = 60_000;

@Injectable()
export class TrainingService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private normalizeScenario(raw: string): TrainingScenario {
    const key = raw.toLowerCase();
    return SCENARIO_MAP[key] ?? (raw.toUpperCase() as TrainingScenario);
  }

  private async resolveEmployeeByUserId(userId: string) {
    const emp = await this.prisma.employee.findUnique({ where: { userId } });
    if (!emp) throw new NotFoundException('Không tìm thấy hồ sơ nhân viên');
    return emp;
  }

  // ── Questions (legacy hardcode) ──────────────────────────────────────────────

  async getQuestions(scenario?: TrainingScenario) {
    return this.prisma.trainingQuestion.findMany({
      where: { isActive: true, ...(scenario ? { scenario } : {}) },
      orderBy: [{ scenario: 'asc' }, { order: 'asc' }],
    });
  }

  // ── Sessions ─────────────────────────────────────────────────────────────────

  async getMySessions(employeeId: string) {
    return this.prisma.trainingSession.findMany({
      where: { employeeId },
      include: { attempts: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async startSession(employeeId: string, scenario: TrainingScenario) {
    return this.prisma.trainingSession.create({
      data: { employeeId, scenario, status: 'IN_PROGRESS' },
    });
  }

  async submitAttempt(sessionId: string, questionId: string, answer: string) {
    const question = await this.prisma.trainingQuestion.findUnique({ where: { id: questionId } });
    if (!question) throw new NotFoundException('Question not found');
    const isCorrect =
      question.type === 'quiz' && question.correctAnswer
        ? answer.toUpperCase() === question.correctAnswer.toUpperCase()
        : null;
    return this.prisma.trainingAttempt.create({
      data: { sessionId, questionId, answer, isCorrect },
    });
  }

  async gradeSession(sessionId: string, aiScore: Record<string, number>, aiFeedback: string) {
    const session = await this.prisma.trainingSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('Session not found');
    const attempts = await this.prisma.trainingAttempt.findMany({ where: { sessionId } });
    const quizAttempts = attempts.filter((a) => a.isCorrect !== null);
    const quizScore =
      quizAttempts.length > 0
        ? (quizAttempts.filter((a) => a.isCorrect).length / quizAttempts.length) * 100
        : 0;
    const aiValues = Object.values(aiScore);
    const aiAvg = aiValues.length > 0 ? aiValues.reduce((a, b) => a + b, 0) / aiValues.length : 0;
    const totalScore = quizScore * 0.5 + aiAvg * 10 * 0.5;
    return this.prisma.trainingSession.update({
      where: { id: sessionId },
      data: {
        status: 'GRADED',
        quizScore,
        aiScore,
        totalScore: Math.round(totalScore * 10) / 10,
        aiFeedback,
        completedAt: new Date(),
      },
    });
  }

  // ── Quiz flow (Gemini-generated, WF03) ───────────────────────────────────────

  /**
   * Gọi WF03 trực tiếp qua webhook /training-quiz để chấm bài,
   * sau đó lưu TrainingSession + TrainingAttempt vào DB.
   */
  async submitQuiz(
    userId: string,
    scenarioRaw: string,
    answers: Array<{ questionId: number; question: string; type: 'mcq' | 'essay'; answer: string; correctAnswer?: string }>,
  ) {
    const employee = await this.resolveEmployeeByUserId(userId);
    const scenario = this.normalizeScenario(scenarioRaw);

    const n8nBase = this.config.get<string>('N8N_WEBHOOK_URL') ?? 'http://localhost:5678/webhook';
    const webhookUrl = n8nBase.replace(/\/webhook\/chat$/, '/webhook') + '/training-quiz';
    const apiKey = this.config.get<string>('N8N_API_KEY');

    // Gọi WF03 để chấm điểm
    let gradeResult: any;
    try {
      const resp = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { 'x-api-key': apiKey } : {}),
        },
        body: JSON.stringify({
          action: 'submit_quiz',
          scenarioType: scenarioRaw.toLowerCase(),
          employeeId: employee.employeeCode,
          answers,
        }),
        signal: AbortSignal.timeout(N8N_QUIZ_TIMEOUT_MS),
      });

      if (resp.ok) {
        gradeResult = await resp.json();
      } else {
        // Nếu WF03 lỗi, tự tính điểm từ answers
        gradeResult = this.fallbackGrade(answers);
      }
    } catch {
      gradeResult = this.fallbackGrade(answers);
    }

    // Lưu TrainingSession
    const mcqResults = (gradeResult.results ?? []).filter((r: any) => r.type === 'mcq');
    const essayResults = (gradeResult.results ?? []).filter((r: any) => r.type === 'essay');
    const correctCount = mcqResults.filter((r: any) => r.correct).length;
    const quizScore = mcqResults.length > 0 ? (correctCount / mcqResults.length) * 100 : 0;
    const essayAvg =
      essayResults.length > 0
        ? essayResults.reduce((sum: number, r: any) => sum + (r.score ?? 0), 0) / essayResults.length
        : 0;
    const totalScore = Math.round((quizScore * 0.5 + essayAvg * 10 * 0.5) * 10) / 10;

    const session = await this.prisma.trainingSession.create({
      data: {
        employeeId: employee.id,
        scenario,
        status: 'GRADED',
        quizScore: Math.round(quizScore * 10) / 10,
        aiScore: { essay_avg: Math.round(essayAvg * 10) / 10 },
        totalScore,
        aiFeedback: gradeResult.overall_feedback ?? '',
        completedAt: new Date(),
      },
    });

    // Lưu TrainingAttempt cho từng câu (dùng questionId=0 vì câu hỏi do Gemini sinh động)
    const placeholder = await this.ensurePlaceholderQuestion(scenario);
    for (const ans of answers) {
      const resultItem = (gradeResult.results ?? []).find((r: any) => r.id === ans.questionId) ?? {};
      await this.prisma.trainingAttempt.create({
        data: {
          sessionId: session.id,
          questionId: placeholder.id,
          answer: ans.answer,
          isCorrect: ans.type === 'mcq' ? (resultItem.correct ?? null) : null,
          aiEvaluation: {
            question: ans.question,
            type: ans.type,
            feedback: resultItem.feedback ?? '',
            score: resultItem.score ?? null,
            correct_answer: ans.correctAnswer ?? null,
          },
        },
      });
    }

    return {
      sessionId: session.id,
      scenario,
      score_percent: gradeResult.score_percent ?? Math.round(totalScore),
      correct_count: correctCount,
      total_mcq: mcqResults.length,
      essay_avg: Math.round(essayAvg * 10) / 10,
      results: gradeResult.results ?? [],
      overall_feedback: gradeResult.overall_feedback ?? '',
    };
  }

  /** Tự tính điểm offline khi WF03 không khả dụng */
  private fallbackGrade(answers: Array<{ type: string; answer: string; correctAnswer?: string }>) {
    const results = answers.map((a, i) => ({
      id: i + 1,
      type: a.type,
      correct: a.type === 'mcq' ? a.answer.toUpperCase() === (a.correctAnswer ?? '').toUpperCase() : undefined,
      score: a.type === 'essay' ? 6 : undefined,
      feedback: a.type === 'mcq' ? 'Đã chấm tự động.' : 'Câu trả lời đã được ghi nhận.',
    }));
    const mcq = results.filter((r) => r.type === 'mcq');
    const correctCount = mcq.filter((r) => r.correct).length;
    const scorePercent = mcq.length > 0 ? Math.round((correctCount / mcq.length) * 100) : 60;
    return { score_percent: scorePercent, correct_count: correctCount, results, overall_feedback: 'Hệ thống chấm điểm tự động.' };
  }

  /** Đảm bảo luôn có 1 placeholder TrainingQuestion để liên kết TrainingAttempt */
  private async ensurePlaceholderQuestion(scenario: TrainingScenario) {
    const existing = await this.prisma.trainingQuestion.findFirst({ where: { scenario, type: 'scenario' } });
    if (existing) return existing;
    return this.prisma.trainingQuestion.create({
      data: { scenario, type: 'scenario', question: '[AI-generated]', order: 0 },
    });
  }

  // ── Dashboard ─────────────────────────────────────────────────────────────────

  /** GET /training/dashboard/me — dashboard cá nhân */
  async getMyDashboard(userId: string) {
    const employee = await this.resolveEmployeeByUserId(userId);

    const sessions = await this.prisma.trainingSession.findMany({
      where: { employeeId: employee.id, status: 'GRADED' },
      orderBy: { createdAt: 'desc' },
    });

    // Tổng quan
    const totalSessions = sessions.length;
    const avgScore =
      totalSessions > 0
        ? Math.round((sessions.reduce((s, x) => s + x.totalScore, 0) / totalSessions) * 10) / 10
        : 0;

    // Theo scenario
    const byScenario: Record<string, { attempts: number; totalScore: number }> = {};
    for (const s of sessions) {
      const key = s.scenario;
      if (!byScenario[key]) byScenario[key] = { attempts: 0, totalScore: 0 };
      byScenario[key].attempts++;
      byScenario[key].totalScore += s.totalScore;
    }
    const byScenarioArr = Object.entries(byScenario).map(([scenario, v]) => ({
      scenario,
      attempts: v.attempts,
      avgScore: Math.round((v.totalScore / v.attempts) * 10) / 10,
    }));

    // Lịch sử gần nhất (10 bài)
    const recentSessions = sessions.slice(0, 10).map((s) => ({
      sessionId: s.id,
      scenario: s.scenario,
      totalScore: s.totalScore,
      quizScore: s.quizScore,
      completedAt: s.completedAt,
    }));

    return {
      employeeCode: employee.employeeCode,
      totalSessions,
      avgScore,
      byScenario: byScenarioArr,
      recentSessions,
    };
  }

  /** GET /training/dashboard/overview — tổng công ty (Admin) */
  async getOverviewDashboard() {
    const employees = await this.prisma.employee.findMany({
      select: {
        id: true,
        employeeCode: true,
        fullName: true,
        department: { select: { name: true } },
        trainingSessions: {
          where: { status: 'GRADED' },
          select: { totalScore: true, scenario: true, completedAt: true },
        },
      },
    });

    const totalEmployees = employees.length;
    const employeeList = employees.map((e) => {
      const sessions = e.trainingSessions;
      const avgScore =
        sessions.length > 0
          ? Math.round((sessions.reduce((s, x) => s + x.totalScore, 0) / sessions.length) * 10) / 10
          : null;
      return {
        employeeCode: e.employeeCode,
        fullName: e.fullName,
        department: e.department?.name ?? '—',
        totalSessions: sessions.length,
        avgScore,
      };
    });

    // Theo phòng ban
    const deptMap: Record<string, { employeeCount: number; sessionCount: number; totalScore: number }> = {};
    for (const e of employees) {
      const deptName = e.department?.name ?? 'Chưa phân phòng';
      if (!deptMap[deptName]) deptMap[deptName] = { employeeCount: 0, sessionCount: 0, totalScore: 0 };
      deptMap[deptName].employeeCount++;
      deptMap[deptName].sessionCount += e.trainingSessions.length;
      deptMap[deptName].totalScore += e.trainingSessions.reduce((s, x) => s + x.totalScore, 0);
    }
    const byDepartment = Object.entries(deptMap).map(([department, v]) => ({
      department,
      employeeCount: v.employeeCount,
      sessionCount: v.sessionCount,
      avgScore: v.sessionCount > 0 ? Math.round((v.totalScore / v.sessionCount) * 10) / 10 : null,
      completionRate: Math.round((v.sessionCount / (v.employeeCount * 6)) * 100), // 6 scenarios
    }));

    const totalSessions = employees.reduce((s, e) => s + e.trainingSessions.length, 0);
    const overallAvgScore =
      totalSessions > 0
        ? Math.round(
            (employees.reduce((s, e) => s + e.trainingSessions.reduce((ss, x) => ss + x.totalScore, 0), 0) /
              totalSessions) *
              10,
          ) / 10
        : null;

    return {
      totalEmployees,
      totalSessions,
      overallAvgScore,
      byDepartment,
      employeeList,
    };
  }

  // ── Analytics (legacy) ────────────────────────────────────────────────────────

  async getAnalytics(month?: number, year?: number) {
    const now = new Date();
    const filterMonth = month ?? now.getMonth() + 1;
    const filterYear = year ?? now.getFullYear();
    const start = new Date(filterYear, filterMonth - 1, 1);
    const end = new Date(filterYear, filterMonth, 0);

    const sessions = await this.prisma.trainingSession.findMany({
      where: { status: 'GRADED', completedAt: { gte: start, lte: end } },
      include: {
        employee: {
          select: {
            fullName: true,
            employeeCode: true,
            department: { select: { name: true } },
          },
        },
      },
    });

    if (sessions.length === 0)
      return {
        sessions: [],
        radarData: [],
        benchmark: { professional: 8, empathy: 8, problemSolving: 8, clarity: 8 },
      };

    const totals = { professional: 0, empathy: 0, problemSolving: 0, clarity: 0 };
    let count = 0;
    for (const s of sessions) {
      const ai = s.aiScore as any;
      if (ai) {
        totals.professional += ai.professional ?? 0;
        totals.empathy += ai.empathy ?? 0;
        totals.problemSolving += ai.problemSolving ?? 0;
        totals.clarity += ai.clarity ?? 0;
        count++;
      }
    }

    const radarData =
      count > 0
        ? [
            { subject: 'Chuyên Nghiệp', benchmark: 8, actual: Math.round((totals.professional / count) * 10) / 10, fullMark: 10 },
            { subject: 'Thấu Cảm', benchmark: 8, actual: Math.round((totals.empathy / count) * 10) / 10, fullMark: 10 },
            { subject: 'Giải Quyết Vấn Đề', benchmark: 8, actual: Math.round((totals.problemSolving / count) * 10) / 10, fullMark: 10 },
            { subject: 'Diễn Đạt Rõ Ràng', benchmark: 8, actual: Math.round((totals.clarity / count) * 10) / 10, fullMark: 10 },
          ]
        : [];

    return { sessions, radarData, benchmark: { professional: 8, empathy: 8, problemSolving: 8, clarity: 8 } };
  }
}
