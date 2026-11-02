import { PrismaClient } from '../packages/database/node_modules/@prisma/client/default.js';

const prisma = new PrismaClient();
const API_URL = 'http://127.0.0.1:3001/api/v1/n8n';
const API_KEY = process.env.HR_API_KEY;
if (!API_KEY) {
  console.error('Thiếu HR_API_KEY. Set trước khi chạy.');
  process.exit(1);
}

const headers = {
  'Content-Type': 'application/json',
  'x-api-key': API_KEY,
};

async function runTest() {
  console.log('=== BẮT ĐẦU KIỂM THỬ LUỒNG RESET SAU 12H ĐÊM (CÁCH 2) ===\n');

  const testUserId = `test_zalo_${Date.now()}`;

  // Bước 1: Khởi tạo phiên chat mới cho khách hàng
  console.log(`1. Tạo session mới cho khách: ${testUserId}`);
  const res1 = await fetch(`${API_URL}/chat/session`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      channel: 'zalo',
      type: 'CSKH',
      externalId: testUserId,
    }),
  });
  const session1 = await res1.json();
  console.log(`   -> Session ID: ${session1.id}, isActive: ${session1.isActive}`);
  if (session1.isActive !== true) {
    throw new Error('Test 1 thất bại: Session mới phải có isActive: true');
  }
  console.log('   ✅ Test 1: Khách mới tạo session -> Bot bật (isActive: true)\n');

  // Bước 2: Giả lập sự kiện Escalate (vượt thẩm quyền -> bàn giao người thật)
  console.log('2. Giả lập AI phát hiện vấn đề nhạy cảm -> Gọi Escalate to Admin');
  const resEscalate = await fetch(`${API_URL}/escalate`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      sessionId: session1.id,
      userId: testUserId,
      channel: 'zalo',
      lastMessage: 'Tôi muốn kiện công ty các người!',
      reason: 'Khách đe dọa pháp lý',
    }),
  });
  const notif = await resEscalate.json();
  console.log(`   -> Đã tạo Notification: "${notif.title}" (ID: ${notif.id})`);

  // Kiểm tra trong database: session1 phải chuyển sang isActive = false
  const updatedDbSession = await prisma.aiChatSession.findUnique({
    where: { id: session1.id },
  });
  console.log(`   -> Trạng thái session sau khi Escalate: isActive = ${updatedDbSession.isActive}`);
  if (updatedDbSession.isActive !== false) {
    throw new Error('Test 2 thất bại: Escalate phải set isActive = false');
  }
  console.log('   ✅ Test 2: Sau khi Escalate -> Bot đã bị tắt (isActive: false)\n');

  // Bước 3: Khách hàng nhắn tiếp trong cùng ngày hôm nay
  console.log('3. Khách hàng nhắn tiếp trong cùng ngày (chưa qua 12h đêm)');
  const res3 = await fetch(`${API_URL}/chat/session`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      channel: 'zalo',
      type: 'CSKH',
      externalId: testUserId,
    }),
  });
  const session3 = await res3.json();
  console.log(`   -> Nhận lại Session ID: ${session3.id}, isActive: ${session3.isActive}`);
  if (session3.id !== session1.id || session3.isActive !== false) {
    throw new Error('Test 3 thất bại: Trong cùng ngày phải giữ nguyên session cũ với isActive: false');
  }
  console.log('   ✅ Test 3: Cùng ngày nhắn tiếp -> Vẫn dùng session cũ và Bot vẫn tắt\n');

  // Bước 4: Test chức năng Admin chủ động bật lại Bot ngay trong ngày
  console.log('4. Admin xử lý xong, bấm nút "Bật lại Bot" trên Web Portal');
  const resReactivate = await fetch(`${API_URL}/chat/session/${session1.id}/reactivate`, {
    method: 'POST',
    headers,
  });
  const sessionReactivated = await resReactivate.json();
  console.log(`   -> Trạng thái sau khi Admin bật lại: isActive = ${sessionReactivated.isActive}`);
  if (sessionReactivated.isActive !== true) {
    throw new Error('Test 4 thất bại: Reactivate phải đổi isActive = true');
  }
  console.log('   ✅ Test 4: Admin bật lại thành công (isActive: true)\n');

  // Bước 5: Test Reset Tự Động Qua 12h Đêm
  console.log('5. Giả lập qua 12h đêm hôm qua (Mô phỏng session được cập nhật từ hôm qua)');
  // Đặt lại session1 thành hôm qua và isActive = false
  const yesterday = new Date(Date.now() - 25 * 60 * 60 * 1000);
  await prisma.aiChatSession.update({
    where: { id: session1.id },
    data: {
      isActive: false,
      updatedAt: yesterday,
    },
  });

  console.log('   -> Sáng hôm sau, khách hàng nhắn tin lại...');
  const res5 = await fetch(`${API_URL}/chat/session`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      channel: 'zalo',
      type: 'CSKH',
      externalId: testUserId,
    }),
  });
  const sessionNewDay = await res5.json();
  console.log(`   -> Session ID mới: ${sessionNewDay.id} (khác ID cũ: ${session1.id})`);
  console.log(`   -> Trạng thái Session mới: isActive = ${sessionNewDay.isActive}`);

  if (sessionNewDay.id === session1.id || sessionNewDay.isActive !== true) {
    throw new Error('Test 5 thất bại: Sau 12h đêm phải sinh session mới toanh với isActive: true');
  }
  console.log('   ✅ Test 5: Tự động reset sau 12h đêm thành công! Bot tự động hồi sinh!\n');

  // Dọn dẹp dữ liệu test
  await prisma.aiChatMessage.deleteMany({ where: { session: { externalId: testUserId } } });
  await prisma.aiChatSession.deleteMany({ where: { externalId: testUserId } });
  await prisma.notification.deleteMany({ where: { data: { path: ['userId'], equals: testUserId } } });
  await prisma.$disconnect();

  console.log('🎉 TOÀN BỘ 5/5 BÀI TEST ĐÃ VƯỢT QUA 100%! HỆ THỐNG HOẠT ĐỘNG CHUẨN XÁC!');
}

runTest().catch((err) => {
  console.error('❌ Lỗi kiểm thử:', err);
  process.exit(1);
});
