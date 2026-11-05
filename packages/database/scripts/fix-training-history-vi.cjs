/**
 * Chuẩn hoá lịch sử chat đào tạo cũ bị ASCII (trước khi sửa WF03).
 * - "Day la bai kiem tra..." → "Đây là bài kiểm tra..."
 * - "Ket qua: ... Dung ..." → "Kết quả: ... Đúng ..."
 * - "He thong cham diem tu dong." → "Hệ thống chấm điểm tự động."
 * - Quiz fallback cũ (Bien ho cho cong ty...) → bộ câu hỏi tiếng Việt có dấu.
 *
 * Chạy:
 *   node scripts/fix-training-history-vi.cjs          # dry-run
 *   node scripts/fix-training-history-vi.cjs --apply  # ghi DB
 */
const { PrismaClient } = require('@prisma/client');

const p = new PrismaClient();
const apply = process.argv.includes('--apply');

const properFallback = [
  { id: 1, type: 'mcq', question: 'Khi khách hàng phản nàn, bước đầu tiên bạn nên:', options: { A: 'Biện hộ cho công ty', B: 'Lắng nghe và đồng cảm', C: 'Chuyển cuộc gọi', D: 'Yêu cầu bằng chứng' }, correct: 'B', explanation: 'Lắng nghe là bước quan trọng nhất.' },
  { id: 2, type: 'mcq', question: 'Câu nào thể hiện sự đồng cảm?', options: { A: 'Đó không phải lỗi của chúng tôi', B: 'Tôi hiểu bạn đang thất vọng', C: 'Bạn cần đọc kỹ điều khoản', D: 'Chúng tôi đã giải quyết rồi' }, correct: 'B', explanation: 'Thể hiện hiểu cảm xúc khách.' },
  { id: 3, type: 'mcq', question: 'Để xác nhận đã hiểu vấn đề, bạn:', options: { A: 'Gật đầu im lặng', B: 'Tóm tắt lại vấn đề của khách', C: 'Hỏi nhiều câu liên tiếp', D: 'Chờ khách nói xong mới đưa giải pháp' }, correct: 'B', explanation: 'Tóm tắt giúp xác nhận hiểu đúng.' },
  { id: 4, type: 'mcq', question: 'Khi không có thẩm quyền, bạn:', options: { A: 'Từ chối hỗ trợ', B: 'Hứa hẹn không chắc chắn', C: 'Leo thang đúng người có thẩm quyền', D: 'Bỏ qua khiếu nại' }, correct: 'C', explanation: 'Escalation đúng quy trình là chuyên nghiệp.' },
  { id: 5, type: 'mcq', question: 'Sau khi giải quyết, bạn nên:', options: { A: 'Kết thúc ngay', B: 'Follow-up xác nhận khách hài lòng', C: 'Viết báo cáo ngay', D: 'Chờ khách liên hệ lại' }, correct: 'B', explanation: 'Follow-up thể hiện sự quan tâm.' },
  { id: 6, type: 'essay', question: 'Mô tả từng bước xử lý khi khách hàng phản nàn đơn hàng đến muộn và sản phẩm bị hỏng.' },
  { id: 7, type: 'essay', question: 'Nếu khách hàng vẫn không hài lòng sau khi bạn đề xuất giải pháp, bạn sẽ làm gì?' },
];

function normalizeContent(content) {
  return String(content || '')
    .replace(/^Day la bai kiem tra dao tao cua ban:/, 'Đây là bài kiểm tra đào tạo của bạn:')
    .replace(/^Ket qua: /, 'Kết quả: ')
    .replace(/^(Kết quả: [\d.]+% - )Dung /, '$1Đúng ')
    .replace(/He thong cham diem tu dong\./g, 'Hệ thống chấm điểm tự động.');
}

function hasVietnamese(text) {
  return /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(String(text || ''));
}

function isOldFallback(quiz) {
  if (!Array.isArray(quiz) || quiz.length === 0) return false;
  const text = quiz.map((q) => `${q.question || ''} ${JSON.stringify(q.options || {})}`).join(' ');
  // Quiz cũ bị sinh không dấu (kể cả AI-generated) → thay bằng bộ chuẩn có dấu.
  return !hasVietnamese(text);
}

(async () => {
  const msgs = await p.aiChatMessage.findMany({
    where: { role: 'assistant', session: { type: 'TRAINING' } },
    select: { id: true, content: true, metadata: true, createdAt: true },
  });

  let contentChanged = 0;
  let quizChanged = 0;

  for (const m of msgs) {
    const nextContent = normalizeContent(m.content);
    const metadata = m.metadata && typeof m.metadata === 'object' && !Array.isArray(m.metadata)
      ? { ...m.metadata }
      : m.metadata;
    let nextMetadata = metadata;
    let quizTouched = false;

    if (metadata && typeof metadata === 'object' && isOldFallback(metadata.quiz)) {
      nextMetadata = { ...metadata, quiz: properFallback };
      quizTouched = true;
    }

    if (nextContent !== m.content || quizTouched) {
      if (nextContent !== m.content) contentChanged++;
      if (quizTouched) quizChanged++;
      console.log(`${quizTouched ? '[quiz]' : '[text]'} ${m.id} ${m.createdAt.toISOString()}`);
      if (apply) {
        await p.aiChatMessage.update({
          where: { id: m.id },
          data: { content: nextContent, ...(quizTouched ? { metadata: nextMetadata } : {}) },
        });
      }
    }
  }

  console.log(`\n${apply ? 'APPLIED' : 'DRY-RUN'}: content=${contentChanged}, quiz=${quizChanged}`);
  await p.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await p.$disconnect();
  process.exit(1);
});
