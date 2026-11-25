import { AiContextService } from './ai-context.service';

describe('AiContextService — escalateToHuman & createOrGetSession', () => {
  it('escalateToHuman: chỉ emit notification:new tới từng room user:${admin.id}, không emit trùng vào room admin', async () => {
    const emitMock = jest.fn();
    const toMock = jest.fn().mockReturnValue({ emit: emitMock, to: jest.fn() });
    const gateway = { server: { to: toMock } };

    const prisma = {
      aiChatSession: { update: jest.fn().mockResolvedValue({}) },
      user: {
        findMany: jest.fn().mockResolvedValue([{ id: 'adm-1' }, { id: 'adm-2' }]),
      },
      notification: {
        create: jest
          .fn()
          .mockImplementation(({ data }: any) => Promise.resolve({ id: `n-${data.userId}`, ...data })),
      },
    };

    const service = new AiContextService(prisma as any, {} as any, gateway as any, {} as any);
    const res = await service.escalateToHuman({
      sessionId: 'sess-1',
      userId: 'U123',
      channel: 'zalo',
      lastMessage: 'Tôi cần gặp nhân viên',
      reason: 'Khách yêu cầu gặp người thật',
    });

    expect(res.notified).toBe(2);
    expect(toMock).toHaveBeenCalledTimes(2);
    expect(toMock).toHaveBeenNthCalledWith(1, 'user:adm-1');
    expect(toMock).toHaveBeenNthCalledWith(2, 'user:adm-2');
    expect(emitMock).toHaveBeenCalledTimes(2);
  });

  it('createOrGetSession: tự động đồng bộ session.type sang TRAINING khi WF03 gọi lại với sessionId cũ mang type HR_QA', async () => {
    const now = new Date();
    const prisma = {
      employee: { findFirst: jest.fn().mockResolvedValue({ id: 'emp-1' }) },
      aiChatSession: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'sess-1',
          employeeId: 'emp-1',
          type: 'HR_QA',
          isActive: true,
          updatedAt: now,
          messages: [],
        }),
        update: jest.fn().mockImplementation(({ data }: any) =>
          Promise.resolve({
            id: 'sess-1',
            employeeId: 'emp-1',
            type: data.type,
            isActive: true,
            updatedAt: now,
            messages: [],
          }),
        ),
      },
    };

    const service = new AiContextService(prisma as any, {} as any, undefined as any, {} as any);
    const session = await service.createOrGetSession({
      sessionId: 'sess-1',
      employeeId: 'emp-1',
      type: 'TRAINING',
      channel: 'web',
    });

    expect(prisma.aiChatSession.update).toHaveBeenCalledWith({
      where: { id: 'sess-1' },
      data: { type: 'TRAINING' },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    expect(session.type).toBe('TRAINING');
  });
});
