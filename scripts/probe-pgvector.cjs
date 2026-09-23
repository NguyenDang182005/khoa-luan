const path = require('path');
const { PrismaClient } = require(path.resolve(__dirname, '..', 'packages', 'database', 'node_modules', '@prisma', 'client'));
const prisma = new PrismaClient();

async function main() {
  const ext = await prisma.$queryRawUnsafe(`SELECT extname FROM pg_extension WHERE extname = 'vector'`);
  console.log('vector extension:', JSON.stringify(ext));
  const col = await prisma.$queryRawUnsafe(`
    SELECT column_name, data_type, udt_name
    FROM information_schema.columns
    WHERE table_name = 'policy_chunks' AND column_name IN ('embedding', 'embedding_json')
  `);
  console.log('policy_chunks columns:', JSON.stringify(col));
  const count = await prisma.$queryRawUnsafe(`SELECT count(*)::int AS n FROM policy_chunks`);
  console.log('policy_chunks rows:', JSON.stringify(count));
  const emb = await prisma.$queryRawUnsafe(`SELECT count(*)::int AS n FROM policy_chunks WHERE embedding IS NOT NULL`);
  console.log('rows with embedding NOT NULL:', JSON.stringify(emb));
}

main()
  .catch((e) => { console.error('ERR', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
