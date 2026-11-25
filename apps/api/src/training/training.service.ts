import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { vnDateUtc, vnMonth, vnMonthRange } from '../common/vn-date';

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

/** Mỗi nhân viên tối đa 5 lượt làm bài / kịch bản / ngày (chống thi lại vô hạn để lấy điểm cao) */
const MAX_QUIZ_ATTEMPTS_PER_DAY = 5;

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

  /**
   * #7: đọc đáp án đúng của bài quiz do WF03 sinh (server đã stash khi gọi chat).
   * Trả về Map questionId -> đáp án đúng.
   */
  private async loadServerQuizAnswers(
    employee: { id: string },
    scenario: string,
  ): Promise<Map<number, string | undefined>> {
    const map = new Map<number, string | undefined>();
    const msgs = await this.prisma.aiChatMessage.findMany({
      where: {
        role: 'assistant',
        // WF03 lưu scenarioType dạng lowercase (customer_complaint),
        // còn `scenario` ở đây là enum uppercase (CUSTOMER_COMPLAINT).
        OR: [
          { metadata: { path: ['scenarioType'], equals: scenario } },
          { metadata: { path: ['scenarioType'], equals: scenario.toLowerCase() } },
        ],
        session: { employeeId: employee.id, type: 'TRAINING' },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { metadata: true },
    });
    // Message mới nhất có thể là tin "đã chấm xong" (metadata.grade), không chứa quiz.
    // Tìm ngược về message có metadata.quiz do WF03 stash lúc sinh đề.
    const msg = msgs.find((m) => Array.isArray((m.metadata as any)?.quiz));
    const quiz = (msg?.metadata as any)?.quiz;
    if (!Array.isArray(quiz)) return map;
    for (const q of quiz) {
      const ans = q?.correct ?? q?.correctAnswer;
      if (ans) map.set(Number(q.id), String(ans));
    }
    return map;
  }

  // ── Questions (legacy hardcode) ──────────────────────────────────────────────

  async getQuestions(scenario?: TrainingScenario) {
    return this.prisma.trainingQuestion.findMany({
      where: { isActive: true, ...(scenario ? { scenario } : {}) },
      orderBy: [{ scenario: 'asc' }, { order: 'asc' }],
    });
  }

  // ── Sessions ─────────────────────────────────────────────────────────────────

  async getMySessions(userId: string) {
    const employee = await this.resolveEmployeeByUserId(userId);
    return this.prisma.trainingSession.findMany({
      where: { employeeId: employee.id },
      include: { attempts: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async startSession(userId: string, scenario: TrainingScenario) {
    const employee = await this.resolveEmployeeByUserId(userId);
    return this.prisma.trainingSession.create({
      data: { employeeId: employee.id, scenario, status: 'IN_PROGRESS' },
    });
  }

  async submitAttempt(
    sessionId: string,
    questionId: string,
    answer: string,
    userId?: string,
  ) {
    const session = await this.prisma.trainingSession.findUnique({
      where: { id: sessionId },
      select: { employeeId: true },
    });
    if (!session) throw new NotFoundException('Session not found');
    if (userId) {
      const employee = await this.resolveEmployeeByUserId(userId);
      if (session.employeeId !== employee.id) {
        throw new ForbiddenException('Không có quyền nộp bài cho phiên của người khác');
      }
    }
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

    const attemptsToday = await this.prisma.trainingSession.count({
      where: {
        employeeId: employee.id,
        scenario,
        status: 'GRADED',
        createdAt: { gte: vnDateUtc() },
      },
    });
    if (attemptsToday >= MAX_QUIZ_ATTEMPTS_PER_DAY) {
      throw new BadRequestException(
        `Đã hết ${MAX_QUIZ_ATTEMPTS_PER_DAY} lượt làm bài cho kịch bản này hôm nay. Vui lòng thử lại vào ngày mai.`,
      );
    }

    const aiCfg = await this.prisma.aiAgentConfig
      ?.findUnique?.({ where: { id: 'default' } })
      .catch(() => null);
    const n8nBase =
      aiCfg?.webhookUrl ||
      this.config.get<string>('N8N_WEBHOOK_URL') ||
      'http://localhost:5678/webhook';
    const webhookUrl = n8nBase.replace(/\/webhook(\/chat)?$/, '/webhook') + '/training-quiz';
    const apiKey = aiCfg?.apiKey || this.config.get<string>('N8N_API_KEY');
    const timeoutMs = aiCfg?.timeoutMs || N8N_QUIZ_TIMEOUT_MS;

    // Đáp án đúng lấy từ bản WF03 đã stash server-side khi sinh bài.
    // Phải load TRƯỚC khi gọi grader và LUÔN ghi đè correctAnswer do client gửi (chống spoofing).
    const correctById = await this.loadServerQuizAnswers(employee, scenario);
    const answersForGrade = answers.map((a) =>
      a.type === 'mcq'
        ? {
            ...a,
            correctAnswer: correctById.has(a.questionId)
              ? correctById.get(a.questionId)
              : a.correctAnswer,
          }
        : a,
    );

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
          answers: answersForGrade,
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (resp.ok) {
        gradeResult = await resp.json();
      } else {
        // Nếu WF03 lỗi, tự tính điểm từ answers
        gradeResult = this.fallbackGrade(answersForGrade);
      }
    } catch {
      gradeResult = this.fallbackGrade(answersForGrade);
    }

    // Lưu TrainingSession — hỗ trợ cả trường trực tiếp lẫn trường lồng trong scoring (tương thích n8n)
    const rawScoring = (gradeResult?.scoring && typeof gradeResult.scoring === 'object') ? gradeResult.scoring : {};
    const rawResults: any[] = Array.isArray(gradeResult?.results)
      ? gradeResult.results
      : Array.isArray(rawScoring.results)
        ? rawScoring.results
        : [];
    const mcqResults = rawResults.filter((r: any) => r.type === 'mcq');
    const essayResults = rawResults.filter((r: any) => r.type === 'essay');

    // #7: KHÔNG tin correctAnswer do client gửi (nếu tin, người học tự gửi
    // đáp án đúng và luôn 100%). Đáp án đúng lấy từ bản WF03 đã stash server-side
    // khi sinh bài (metadata.quiz của message assistant gần nhất).
    // ── Chấm MCQ deterministic phía server ──────────────────────────────────────
    // Đáp án đúng đọc từ DB; nếu câu không có trong DB thì fallback results[] của WF03.
    const mcqIsCorrect = (ans: { type: string; answer: string; questionId: number }): boolean | null => {
      if (ans.type !== 'mcq') return null;
      const expected = correctById.get(ans.questionId);
      if (expected && ans.answer) {
        return ans.answer.trim().toUpperCase() === expected.trim().toUpperCase();
      }
      const r = rawResults.find((item: any) => item.id === ans.questionId);
      return typeof r?.correct === 'boolean' ? r.correct : null;
    };

    const mcqAnswers = answers.filter((a) => a.type === 'mcq');
    const gradable = mcqAnswers.filter((a) => correctById.has(a.questionId));
    const correctCount =
      gradable.length > 0
        ? mcqAnswers.filter((a) => mcqIsCorrect(a) === true).length
        : mcqResults.filter((r: any) => r.correct === true).length > 0
          ? mcqResults.filter((r: any) => r.correct === true).length
          : typeof gradeResult?.correct_count === 'number'
            ? gradeResult.correct_count
            : typeof rawScoring.correct_count === 'number'
              ? rawScoring.correct_count
              : 0;
    const totalMcq =
      mcqAnswers.length > 0
        ? mcqAnswers.length
        : typeof gradeResult?.total_mcq === 'number'
          ? gradeResult.total_mcq
          : typeof rawScoring.total_mcq === 'number'
            ? rawScoring.total_mcq
            : mcqResults.length;
    const quizScore = totalMcq > 0 ? (correctCount / totalMcq) * 100 : 0;
    const essayAvg =
      typeof gradeResult?.essay_avg === 'number'
        ? gradeResult.essay_avg
        : typeof rawScoring.essay_avg === 'number'
          ? rawScoring.essay_avg
          : essayResults.length > 0
            ? essayResults.reduce((sum: number, r: any) => sum + (r.score ?? 0), 0) / essayResults.length
            : 0;

    // ── Điểm 4 tiêu chí từ criteria{} từng essay (WF03 trả từ 25/09) ────────────
    // LLM chấm mỗi câu tự luận theo 4 tiêu chí 0-10; trung bình theo tiêu chí.
    // Fallback: nếu LLM không trả criteria (prompt cũ / parse hụt) → dùng essay_avg
    // cho cả 4 trục như behavior cũ, radar không bao giờ crash.
    const critAvg = (key: string): number => {
      const graded = essayResults.filter(
        (r: any) => r.criteria && typeof r.criteria[key] === 'number',
      );
      if (graded.length > 0) {
        return graded.reduce((s: number, r: any) => s + r.criteria[key], 0) / graded.length;
      }
      const perEssay = essayResults
        .map((r: any) => r.score)
        .filter((s: any) => typeof s === 'number');
      return perEssay.length > 0
        ? perEssay.reduce((a: number, b: number) => a + b, 0) / perEssay.length
        : essayAvg;
    };
    const criteriaScore = {
      professional: Math.round(critAvg('chuyen_nghiep') * 10) / 10,
      empathy: Math.round(critAvg('dong_cam') * 10) / 10,
      problemSolving: Math.round(critAvg('giai_quyet') * 10) / 10,
      clarity: Math.round(critAvg('ro_rang') * 10) / 10,
      essay_avg: Math.round(essayAvg * 10) / 10,
    };
    const totalScore = Math.round((quizScore * 0.5 + essayAvg * 10 * 0.5) * 10) / 10;

    const overallFeedback =
      gradeResult?.overall_feedback ||
      rawScoring.overall_feedback ||
      gradeResult?.answer ||
      '';

    // Chuẩn hoá results cho UI: luôn có đủ câu, kèm correct_answer + feedback.
    // q.correct bị strip khỏi public quiz để chống tự chấm, nên UI chỉ có thể
    // hiển thị đáp án đúng từ kết quả submit này.
    const resultsWithAnswers = answers.map((ans) => {
      const item: any = rawResults.find((r: any) => r.id === ans.questionId) ?? {};
      if (ans.type === 'mcq') {
        const isCorrect = mcqIsCorrect(ans) === true;
        const correctAnswer =
          correctById.get(ans.questionId) ?? item.correct_answer ?? ans.correctAnswer ?? null;
        return {
          ...item,
          id: ans.questionId,
          type: 'mcq',
          correct: isCorrect,
          correct_answer: correctAnswer,
          feedback:
            item.feedback ||
            (isCorrect
              ? 'Chính xác.'
              : correctAnswer
                ? `Đáp án đúng là ${correctAnswer}.`
                : 'Chưa xác định được đáp án.'),
        };
      }
      return {
        ...item,
        id: ans.questionId,
        type: 'essay',
        score: typeof item.score === 'number' ? item.score : null,
        max_score: 10,
        criteria: item.criteria ?? null,
        feedback:
          item.feedback ||
          'Câu trả lời đã được ghi nhận. Hệ thống chưa chấm được chi tiết do lỗi kết nối AI.',
      };
    });

    const session = await this.prisma.trainingSession.create({
      data: {
        employeeId: employee.id,
        scenario,
        status: 'GRADED',
        quizScore: Math.round(quizScore * 10) / 10,
        aiScore: criteriaScore, // 4 tiêu chí thật của WF03 + essay_avg (fallback: cả 4 = essay_avg)
        totalScore,
        aiFeedback: overallFeedback,
        completedAt: new Date(),
      },
    });

    // Lưu TrainingAttempt cho từng câu (dùng questionId=0 vì câu hỏi do Gemini sinh động)
    const placeholder = await this.ensurePlaceholderQuestion(scenario);
    for (const ans of answers) {
      const resultItem = resultsWithAnswers.find((r: any) => r.id === ans.questionId) ?? {};
      await this.prisma.trainingAttempt.create({
        data: {
          sessionId: session.id,
          questionId: placeholder.id,
          answer: ans.answer,
          // Cùng nguồn sự thật với aggregate phía trên — không còn NULL dù WF03 khuyết results
          isCorrect: mcqIsCorrect(ans),
          aiEvaluation: {
            question: ans.question,
            type: ans.type,
            feedback: resultItem.feedback ?? '',
            score: resultItem.score ?? null,
            criteria: resultItem.criteria ?? null,
            correct_answer: resultItem.correct_answer ?? ans.correctAnswer ?? null,
          },
        },
      });
    }

    // Tính local từ chính điểm đã lưu — đảm bảo chat (score_percent) và tab (totalScore) luôn khớp nhau
    const scorePercent = Math.round(totalScore);

    return {
      sessionId: session.id,
      scenario,
      score_percent: scorePercent,
      correct_count: correctCount,
      total_mcq: totalMcq,
      essay_avg: Math.round(essayAvg * 10) / 10,
      results: resultsWithAnswers,
      overall_feedback: overallFeedback,
    };
  }

  /** Tự tính điểm offline khi WF03 không khả dụng */
  private fallbackGrade(
    answers: Array<{ questionId?: number; type: string; answer: string; correctAnswer?: string }>,
  ) {
    const results = answers.map((a, i) => ({
      id: a.questionId ?? i + 1,
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
      // Đồng bộ với Dashboard: bỏ hồ sơ đã nghỉ việc khỏi thống kê đào tạo.
      where: { status: { not: 'TERMINATED' } },
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
      completionRate: Math.min(100, Math.round((v.sessionCount / (v.employeeCount * 6)) * 100)), // 6 scenarios
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
    const { month: curMonth, year: curYear } = vnMonth(now);
    const filterMonth = month ?? curMonth;
    const filterYear = year ?? curYear;
    // #2: dùng ranh giới ngày VN (UTC) — new Date(y,m,0) trước đây trả ngày cuối tháng TRƯỚC → filter rỗng.
    const { gte: start, lt: end } = vnMonthRange(filterYear, filterMonth);

    const sessions = await this.prisma.trainingSession.findMany({
      where: { status: 'GRADED', completedAt: { gte: start, lt: end } },
      include: {
        employee: {
          select: {
            fullName: true,
            employeeCode: true,
            department: { select: { name: true } },
          },
        },
        attempts: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            answer: true,
            isCorrect: true,
            aiEvaluation: true,
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
        const fallback = ai.essay_avg ?? 0;
        totals.professional += ai.professional ?? fallback;
        totals.empathy += ai.empathy ?? fallback;
        totals.problemSolving += ai.problemSolving ?? ai.problem_solving ?? fallback;
        totals.clarity += ai.clarity ?? fallback;
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
