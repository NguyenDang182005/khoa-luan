/**
 * E2E test bài đào tạo: login → POST /training/submit (5 MCQ + 2 essay)
 * → xem response chấm → kiểm tra lại bằng /training/dashboard/overview.
 * Chạy: node scripts/e2e-training-test.cjs
 */
const http = require('http');

const req = (path, method, body, token) =>
  new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : null;
    const r = http.request(
      {
        host: '127.0.0.1',
        port: 3001,
        path,
        method,
        headers: {
          ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      },
      (res) => {
        let b = '';
        res.on('data', (c) => (b += c));
        res.on('end', () => resolve({ status: res.statusCode, body: b }));
      },
    );
    r.on('error', (e) => resolve({ status: 0, body: 'ERR ' + e.code }));
    if (data) r.write(data);
    r.end();
  });

(async () => {
  // 1) Login — thử admin trước
  let login = await req('/api/v1/auth/login', 'POST', { email: 'admin@hr-system.com', password: 'Admin@123' });
  if (login.status !== 200) login = await req('/api/v1/auth/login', 'POST', { email: 'hr-admin@company.com', password: 'Admin@123' });
  console.log('1) Login:', login.status);
  if (login.status !== 200) { console.log(login.body); process.exit(1); }
  const token = JSON.parse(login.body).accessToken;

  // 2) Nộp bài test — 5 MCQ (trộn đúng/sai) + 2 essay
  const answers = [
    { questionId: 1, question: 'MCQ 1', type: 'mcq', answer: 'A' },
    { questionId: 2, question: 'MCQ 2', type: 'mcq', answer: 'B' },
    { questionId: 3, question: 'MCQ 3', type: 'mcq', answer: 'C' },
    { questionId: 4, question: 'MCQ 4', type: 'mcq', answer: 'B' },
    { questionId: 5, question: 'MCQ 5', type: 'mcq', answer: 'A' },
    { questionId: 6, question: 'Tình huống: khách hàng phàn nàn...', type: 'essay', answer: 'Tôi sẽ lắng nghe khách, xin lỗi và đưa ra phương án xử lý trong 24h, sau đó báo cáo quản lý để phòng tránh tái diễn.' },
    { questionId: 7, question: 'Tình huống: đồng nghiệp tranh luận...', type: 'essay', answer: 'Tôi sẽ đề xuất họp riêng, nghe quan điểm cả hai bên và thống nhất tiêu chí đánh giá chung trước khi quyết định.' },
  ];
  const submit = await req('/api/v1/training/submit', 'POST', { scenarioType: 'customer_complaint', answers }, token);
  console.log('2) Submit:', submit.status);
  const submitBody = JSON.parse(submit.body);
  console.log(JSON.stringify(submitBody, null, 2).slice(0, 1500));

  // 3) Dashboard overview xem session đã vào bảng xếp hạng chưa
  const ov = await req('/api/v1/training/dashboard/overview', 'GET', null, token);
  console.log('\n3) Overview:', ov.status);
  const ovBody = JSON.parse(ov.body);
  console.log('totalSessions:', ovBody?.totalSessions, '| overallAvgScore:', ovBody?.overallAvgScore);
  const rank = ovBody?.employeeList ?? [];
  if (rank.length) console.log('Top:', JSON.stringify(rank[0]).slice(0, 300));
})();