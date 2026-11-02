import { PrismaService } from '../prisma/prisma.service';

/**
 * Đảm bảo bản ghi cấu hình đơn "default" tồn tại — cùng pattern với OfficeGeofence.
 * Dùng chung giữa SettingsService (CRUD trang Cài Đặt) và LeaveService (tính balance).
 */
export async function ensureDefaultLeavePolicy(prisma: PrismaService) {
  const existing = await prisma.leavePolicy.findUnique({ where: { id: 'default' } });
  if (existing) return existing;
  try {
    return await prisma.leavePolicy.create({
      data: {
        id: 'default',
        seniorityBonusEveryYears: 0,
        seniorityBonusDays: 0,
        maxCarryOverDays: 0,
      },
    });
  } catch (err: any) {
    // #17: 2 tab đăng nhập/chế tạo song song → P2002 race. Đọc lại thay vì 500.
    if (err?.code === 'P2002') {
      const retry = await prisma.leavePolicy.findUnique({ where: { id: 'default' } });
      if (retry) return retry;
    }
    throw err;
  }
}

/** Vùng chấm công — bản ghi đơn "default" (dùng chung Settings và Attendance) */
export async function ensureDefaultGeofence(prisma: PrismaService) {
  const existing = await prisma.officeGeofence.findUnique({ where: { id: 'default' } });
  if (existing) return existing;
  try {
    return await prisma.officeGeofence.create({ data: { id: 'default' } });
  } catch (err: any) {
    if (err?.code === 'P2002') {
      const retry = await prisma.officeGeofence.findUnique({ where: { id: 'default' } });
      if (retry) return retry;
    }
    throw err;
  }
}

/** Chính sách bảo mật — bản ghi đơn "default" */
export async function ensureDefaultSecurityPolicy(prisma: PrismaService) {
  const existing = await prisma.securityPolicy.findUnique({ where: { id: 'default' } });
  if (existing) return existing;
  try {
    return await prisma.securityPolicy.create({ data: { id: 'default' } });
  } catch (err: any) {
    if (err?.code === 'P2002') {
      const retry = await prisma.securityPolicy.findUnique({ where: { id: 'default' } });
      if (retry) return retry;
    }
    throw err;
  }
}

/** Cấu hình AI Agent — bản ghi đơn "default" */
export async function ensureDefaultAiAgentConfig(prisma: PrismaService) {
  const existing = await prisma.aiAgentConfig.findUnique({ where: { id: 'default' } });
  if (existing) return existing;
  try {
    return await prisma.aiAgentConfig.create({ data: { id: 'default' } });
  } catch (err: any) {
    if (err?.code === 'P2002') {
      const retry = await prisma.aiAgentConfig.findUnique({ where: { id: 'default' } });
      if (retry) return retry;
    }
    throw err;
  }
}