// [DEBUG-chatprobe] Inspect recent AI chat sessions/messages to see how far n8n got.
const path = require('path');
const { PrismaClient } = require(path.resolve(__dirname, '..', 'packages', 'database', 'node_modules', '@prisma', 'client'));
const prisma = new PrismaClient();

async function main() {
  const since = new Date(Date.now() - 2 * 60 * 60 * 1000); // last 2h
  const sessions = await prisma.aiChatSession.findMany({
    where: { updatedAt: { gte: since } },
    orderBy: { updatedAt: 'desc' },
    take: 10,
    include: {
      messages: { orderBy: { createdAt: 'asc' }, select: { role: true, content: true, metadata: true, createdAt: true } },
    },
  });
  console.log(`recent sessions (2h): ${sessions.length}`);
  for (const s of sessions) {
    console.log(`- session ${s.id} type=${s.type} channel=${s.channel} employeeId=${s.employeeId} msgs=${s.messages.length} updatedAt=${s.updatedAt.toISOString()}`);
    for (const m of s.messages) {
      console.log(`    [${m.role}] ${JSON.stringify(m.content).slice(0, 80)} meta=${JSON.stringify(m.metadata)}`);
    }
  }
  const totalMsgs = await prisma.aiChatMessage.count();
  console.log(`total messages in DB: ${totalMsgs}`);
}

main()
  .catch((e) => { console.error('ERR', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
