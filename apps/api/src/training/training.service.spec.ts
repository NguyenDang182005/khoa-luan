import { TrainingService } from './training.service';

/**
 * Regression test cho bug "tab Kết quả đào tạo hiển thi sai điểm":
 * WF03 (Gemini) tự đếm correct_count/total_mcq ở mức aggregate và đếm SAI
 * so với chính results[] từng câu của nó. Service phải chấm MCQ deterministic
 * phía server thay vì tin counter của LLM.
 *
 * #7: đáp án đúng KHÔNG lấy từ client (client có thể tự gửi đáp án đúng) —
 * lấy từ bản quiz WF03 đã stash server-side khi sinh bài (metadata.quiz).
 */

// 5 MCQ — học viên trả lời tất cả "B", đáp án đúng B,C,C,B,C → 2/5 đúng
const answers7 = [
  { questionId: 1, question: 'Q1', type: 'mcq' as const, answer: 'B' },
  { questionId: 2, question: 'Q2', type: 'mcq' as const, answer: 'B' },
  { questionId: 3, question: 'Q3', type: 'mcq' as const, answer: 'B' },
  { questionId: 4, question: 'Q4', type: 'mcq' as const, answer: 'B' },
  { questionId: 5, question: 'Q5', type: 'mcq' as const, answer: 'B' },
  // 2 tự luận
  { questionId: 6, question: 'E1', type: 'essay' as const, answer: 'hello' },
  { questionId: 7, question: 'E2', type: 'essay' as const, answer: 'jaaw' },
];

/** Bản quiz WF03 stash server-side khi sinh bài (đáp án đúng B,C,C,B,C) */
const STASHED_QUIZ = {
  quiz: [
    { id: 1, type: 'mcq', correct: 'B' },
    { id: 2, type: 'mcq', correct: 'C' },
    { id: 3, type: 'mcq', correct: 'C' },
    { id: 4, type: 'mcq', correct: 'B' },
    { id: 5, type: 'mcq', correct: 'C' },
    { id: 6, type: 'essay' },
    { id: 7, type: 'essay' },
  ],
};

/** WF03 trả results[] đúng (2 câu MCQ đúng) nhưng aggregate đếm sai correct_count=1 */
const WF03_CONTRADICTORY = {
  score_percent: 10,
  correct_count: 1, // ← SAI: results[] chỉ có 2 câu đúng
  total_mcq: 5,
  results: [
    { id: 1, type: 'mcq', correct: true, feedback: 'ok' },
    { id: 2, type: 'mcq', correct: false, feedback: 'wrong' },
    { id: 3, type: 'mcq', correct: false, feedback: 'wrong' },
    { id: 4, type: 'mcq', correct: true, feedback: 'ok' },
    { id: 5, type: 'mcq', correct: false, feedback: 'wrong' },
    { id: 6, type: 'essay', score: 0, feedback: 'f6' },
    { id: 7, type: 'essay', score: 0, feedback: 'f7' },
  ],
  overall_feedback: 'fb',
};

function buildService(gradeResponse: unknown, stashedQuiz: unknown = STASHED_QUIZ) {
  const prisma: Record<string, any> = {
    employee: { findUnique: jest.fn().mockResolvedValue({ id: 'emp1', employeeCode: 'EMP005' }) },
    aiChatMessage: {
      findFirst: jest.fn().mockResolvedValue(
        stashedQuiz ? { metadata: stashedQuiz } : null,
      ),
    },
    trainingSession: {
      create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 's1', ...data })),
      count: jest.fn().mockResolvedValue(0),
    },
    trainingQuestion: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'q0' }),
    },
    trainingAttempt: { create: jest.fn().mockResolvedValue({}) },
  };
  const config: Record<string, any> = { get: jest.fn().mockReturnValue(undefined) };
  (global as any).fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => gradeResponse,
  });
  const service = new TrainingService(prisma as any, config as any);
  return { service, prisma };
}

describe('TrainingService.submitQuiz — chấm MCQ deterministic phía server', () => {
  it('aggregate của WF03 sai (correct_count=1) → vẫn tính đúng 2/5 = 40%', async () => {
    const { service, prisma } = buildService(WF03_CONTRADICTORY);

    const result = await service.submitQuiz('user1', 'colleague_conflict', answers7);

    // Điểm MCQ phải theo đáp án stash server-side, không theo counter LLM
    expect(result.correct_count).toBe(2);
    expect(result.total_mcq).toBe(5);
    const session = prisma.trainingSession.create.mock.calls[0][0].data;
    expect(session.quizScore).toBe(40); // không phải 20 (1/5) như bug
    // total = 40*0.5 + 0*10*0.5 = 20
    expect(session.totalScore).toBe(20);
    expect(result.score_percent).toBe(20);
    // attempts lưu isCorrect khớp từng câu: T,F,F,T,F
    const isCorrectFlags = prisma.trainingAttempt.create.mock.calls.map(
      (c: any) => c[0].data.isCorrect,
    );
    expect(isCorrectFlags).toEqual([true, false, false, true, false, null, null]);
  });

  it('#7: client gửi correctAnswer sai cũng không ảnh hưởng — server chấm theo bản stash', async () => {
    const { service, prisma } = buildService(WF03_CONTRADICTORY);

    // Học viên gửi correctAnswer: 'B' cho tất cả → nếu tin client sẽ ra 5/5
    const tampered = answers7.map((a) =>
      a.type === 'mcq' ? { ...a, correctAnswer: 'B' } : a,
    );

    const result = await service.submitQuiz('user1', 'colleague_conflict', tampered);

    expect(result.correct_count).toBe(2); // vẫn 2/5 theo đáp án thật
    const session = prisma.trainingSession.create.mock.calls[0][0].data;
    expect(session.quizScore).toBe(40);
  });

  it('không có bản stash → fallback theo results[] từng câu của WF03', async () => {
    const { service } = buildService(
      {
        score_percent: 20,
        correct_count: 1, // aggregate sai
        total_mcq: 5,
        results: [
          { id: 1, type: 'mcq', correct: true },
          { id: 2, type: 'mcq', correct: true },
          { id: 3, type: 'mcq', correct: true },
          { id: 4, type: 'mcq', correct: false },
          { id: 5, type: 'mcq', correct: false },
        ],
        overall_feedback: '',
      },
      null, // không stash
    );

    const result = await service.submitQuiz('user1', 'colleague_conflict', answers7);

    // 3 câu đúng theo results[] (không phải 1 theo counter LLM)
    expect(result.correct_count).toBe(3);
    expect(result.total_mcq).toBe(5);
  });
});