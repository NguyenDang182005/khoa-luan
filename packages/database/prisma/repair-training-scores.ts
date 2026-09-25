/**
 * [repair] Tính lại điểm TrainingSession từ TrainingAttempt (ground truth từng câu).
 *
 * Bối cảnh bug: quizScore/totalScore trước đây lấy counter aggregate do Gemini tự đếm,
 * thường lệch với results[] từng câu; MCQ có khi bị bỏ chấm (isCorrect NULL).
 * Script này:
 *  1. Chấm lại isCorrect cho attempt MCQ từ answer vs aiEvaluation.correct_answer (deterministic).
 *  2. quizScore = số MCQ đúng / tổng MCQ * 100.
 *  3. essayAvg = TB score tự luận (nếu có), fallback aiScore.essay_avg cũ.
 *  4. totalScore = round(quizScore*0.5 + essayAvg*10*0.5, 1); đồng bộ aiScore 4 tiêu chí = essay_avg.
 * Chỉ UPDATE khi giá trị thực sự đổi. Chạy 1 lần: pnpm --filter database exec ts-node --project tsconfig.seed.json prisma/repair-training-scores.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface AiEval {
  type?: string;
  score?: number | null;
  correct_answer?: string | null;
}

async function main() {
  const sessions = await prisma.trainingSession.findMany({
    where: { status: 'GRADED' },
    include: { attempts: true },
    orderBy: { createdAt: 'desc' },
  });

  for (const s of sessions) {
    // Session legacy (seed định dạng cũ): aiScore đã có 4 tiêu chí riêng 0-100,
    // attempts không có aiEvaluation.type → KHÔNG đụng vào.
    const hasTypedAttempts = s.attempts.some((a) => (a.aiEvaluation as AiEval)?.type != null);
    if (!hasTypedAttempts) {
      console.log(`SKIP ${s.id} (legacy seed, giữ nguyên)`);
      continue;
    }

    // 1) Chấm lại MCQ deterministic
    let mcqTotal = 0;
    let mcqCorrect = 0;
    for (const a of s.attempts) {
      const ev = (a.aiEvaluation ?? {}) as AiEval;
      if (ev.type !== 'mcq') continue;
      mcqTotal++;
      if (ev.correct_answer && a.answer) {
        const expected = ev.correct_answer.trim().toUpperCase();
        const actual = a.answer.trim().toUpperCase();
        const isCorrect = actual === expected;
        if (a.isCorrect !== isCorrect) {
          await prisma.trainingAttempt.update({ where: { id: a.id }, data: { isCorrect } });
        }
        if (isCorrect) mcqCorrect++;
      } else if (a.isCorrect === true) {
        mcqCorrect++;
      }
    }

    // 2) quizScore từ attempts (nếu session có MCQ)
    const quizScore =
      mcqTotal > 0
        ? Math.round((mcqCorrect / mcqTotal) * 1000) / 10
        : s.quizScore;

    // 3) essayAvg: ưu tiên score thật của attempts, fallback aiScore.essay_avg
    const essayScores = s.attempts
      .map((a) => (a.aiEvaluation as AiEval)?.score)
      .filter((x): x is number => typeof x === 'number');
    const old = (s.aiScore ?? {}) as Record<string, number | undefined>;
    const essayAvg =
      essayScores.length > 0
        ? Math.round((essayScores.reduce((x, y) => x + y, 0) / essayScores.length) * 10) / 10
        : old.essay_avg ?? 0;

    // 4) totalScore + đồng bộ aiScore
    const totalScore = Math.round((quizScore * 0.5 + essayAvg * 10 * 0.5) * 10) / 10;
    const aiScore = {
      professional: essayAvg,
      empathy: essayAvg,
      problemSolving: essayAvg,
      clarity: essayAvg,
      essay_avg: essayAvg,
    };

    const changed =
      s.quizScore !== quizScore || s.totalScore !== totalScore ||
      JSON.stringify(s.aiScore ?? {}) !== JSON.stringify(aiScore);

    console.log(
      `${changed ? 'FIX' : 'OK '} ${s.id} quiz ${s.quizScore}→${quizScore} | total ${s.totalScore}→${totalScore} | mcq ${mcqCorrect}/${mcqTotal} | essay ${essayAvg}`,
    );

    if (changed) {
      await prisma.trainingSession.update({
        where: { id: s.id },
        data: { quizScore, totalScore, aiScore },
      });
    }
  }
  console.log('Done.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
