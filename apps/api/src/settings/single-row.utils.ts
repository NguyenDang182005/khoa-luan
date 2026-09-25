import { PrismaService } from '../prisma/prisma.service';

/**
 * Đảm bảo bản ghi cấu hình đơn "default" tồn tại — cùng pattern với OfficeGeofence.
 * Dùng chung giữa SettingsService (CRUD trang Cài Đặt) và LeaveService (tính balance).
 */
export async function ensureDefaultLeavePolicy(prisma: PrismaService) {
  const existing = await prisma.leavePolicy.findUnique({ where: { id: 'default' } });
  if (existing) return existing;
  return prisma.leavePolicy.create({ data: { id: 'default' } });
}

/** Chính sách bảo mật — bản ghi đơn "default" */
export async function ensureDefaultSecurityPolicy(prisma: PrismaService) {
  const existing = await prisma.securityPolicy.findUnique({ where: { id: 'default' } });
  if (existing) return existing;
  return prisma.securityPolicy.create({ data: { id: 'default' } });
}

/** Cấu hình AI Agent — bản ghi đơn "default" */
export async function ensureDefaultAiAgentConfig(prisma: PrismaService) {
  const existing = await prisma.aiAgentConfig.findUnique({ where: { id: 'default' } });
  if (existing) return existing;
  return prisma.aiAgentConfig.create({ data: { id: 'default' } });
}
