import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type TrainingScenario = 'CUSTOMER_COMPLAINT' | 'COLLEAGUE_CONFLICT' | 'MANAGER_FEEDBACK' | 'NEW_EMPLOYEE_ONBOARDING' | 'PERFORMANCE_REVIEW' | 'GENERAL_COMMUNICATION';

@Injectable()
export class TrainingService {
  constructor(private prisma: PrismaService) {}

  // --- Questions ---
  async getQuestions(scenario?: TrainingScenario) {
    return this.prisma.trainingQuestion.findMany({
      where: { isActive: true, ...(scenario ? { scenario } : {}) },
      orderBy: [{ scenario: 'asc' }, { order: 'asc' }],
    });
  }

  // --- Sessions ---
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

    const isCorrect = question.type === 'quiz' && question.correctAnswer
      ? answer.toUpperCase() === question.correctAnswer.toUpperCase()
      : null;

    return this.prisma.trainingAttempt.create({
      data: { sessionId, questionId, answer, isCorrect },
    });
  }

  async gradeSession(sessionId: string, aiScore: Record<string, number>, aiFeedback: string) {
    const session = await this.prisma.trainingSession.findUnique({
      where: { id: sessionId },
      include: { attempts: { include: { session: false } } },
    });
    if (!session) throw new NotFoundException('Session not found');

    // Quiz score: % correct quiz questions
    const attempts = await this.prisma.trainingAttempt.findMany({ where: { sessionId } });
    const quizAttempts = attempts.filter(a => a.isCorrect !== null);
    const quizScore = quizAttempts.length > 0
      ? (quizAttempts.filter(a => a.isCorrect).length / quizAttempts.length) * 100
      : 0;

    // AI score average
    const aiValues = Object.values(aiScore);
    const aiAvg = aiValues.length > 0 ? aiValues.reduce((a, b) => a + b, 0) / aiValues.length : 0;
    const totalScore = (quizScore * 0.5) + (aiAvg * 10 * 0.5);

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

  // --- Analytics (admin) ---
  async getAnalytics(month?: number, year?: number) {
    const now = new Date();
    const filterMonth = month ?? now.getMonth() + 1;
    const filterYear = year ?? now.getFullYear();
    const start = new Date(filterYear, filterMonth - 1, 1);
    const end = new Date(filterYear, filterMonth, 0);

    const sessions = await this.prisma.trainingSession.findMany({
      where: { status: 'GRADED', completedAt: { gte: start, lte: end } },
      include: { employee: { select: { fullName: true, employeeCode: true, department: { select: { name: true } } } } },
    });

    if (sessions.length === 0) return { sessions: [], radarData: [], benchmark: { professional: 8, empathy: 8, problemSolving: 8, clarity: 8 } };

    // Aggregate radar data
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

    const benchmark = { professional: 8, empathy: 8, problemSolving: 8, clarity: 8 };
    const radarData = count > 0 ? [
      { subject: 'Chuyên Nghiệp', benchmark: 8, actual: Math.round((totals.professional / count) * 10) / 10, fullMark: 10 },
      { subject: 'Thấu Cảm', benchmark: 8, actual: Math.round((totals.empathy / count) * 10) / 10, fullMark: 10 },
      { subject: 'Giải Quyết Vấn Đề', benchmark: 8, actual: Math.round((totals.problemSolving / count) * 10) / 10, fullMark: 10 },
      { subject: 'Diễn Đạt Rõ Ràng', benchmark: 8, actual: Math.round((totals.clarity / count) * 10) / 10, fullMark: 10 },
    ] : [];

    return { sessions, radarData, benchmark };
  }
}
