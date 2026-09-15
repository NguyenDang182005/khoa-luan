/**
 * seed-knowledge.cjs — Seed kiến thức chính sách vào bảng policy_chunks cho RAG.
 * - Chunk theo đoạn (~600 ký tự)
 * - Embedding: Gemini text-embedding-004 (768 chiều) qua REST API
 * - Dual-mode: luôn ghi embedding_json (JSONB); nếu Postgres có pgvector thì ghi
 *   thêm cột embedding vector(768) + index HNSW để search ANN bằng SQL
 *
 * Chạy: node scripts/seed-knowledge.cjs  (workdir: packages/database)
 * Yêu cầu: GEMINI_API_KEY trong root .env
 */
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { DOCUMENTS } = require('./knowledge-docs.cjs');

const prisma = new PrismaClient();
const EMBED_MODEL = 'models/gemini-embedding-001';
const EMBED_DIM = 768;
const MAX_CHUNK = 600;

function readRootEnv(key) {
  const lines = fs.readFileSync(path.join(__dirname, '../../../.env'), 'utf-8').split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(new RegExp(`^${key}=(.*)$`));
    if (m) return m[1].trim();
  }
  return '';
}

function chunkText(text) {
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const chunks = [];
  let current = '';
  for (const p of paragraphs) {
    if ((current + '\n' + p).length > MAX_CHUNK && current) {
      chunks.push(current);
      current = p;
    } else {
      current = current ? current + '\n' + p : p;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

async function embedText(apiKey, text) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/${EMBED_MODEL}:embedContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: EMBED_MODEL,
        content: { parts: [{ text }] },
        outputDimensionality: EMBED_DIM,
      }),
    },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini embed HTTP ${res.status}: ${body.slice(0, 150)}`);
  }
  const json = await res.json();
  const values = json?.embedding?.values;
  if (!Array.isArray(values) || values.length !== EMBED_DIM) {
    throw new Error(`Embedding dimension unexpected: ${values?.length}`);
  }
  return values;
}

async function main() {
  const apiKey = readRootEnv('GEMINI_API_KEY');
  if (!apiKey) throw new Error('Thiếu GEMINI_API_KEY trong root .env');

  // 1. Đảm bảo schema
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS policy_chunks (
      id SERIAL PRIMARY KEY,
      doc_title TEXT NOT NULL,
      chunk_index INT NOT NULL,
      content TEXT NOT NULL,
      source TEXT,
      embedding_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS ux_policy_chunks_doc_idx ON policy_chunks(doc_title, chunk_index)`,
  );

  // 2. Thử bật pgvector + cột embedding
  let pgvector = false;
  try {
    await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS vector`);
    pgvector = true;
  } catch (e) {
    const have = await prisma.$queryRawUnsafe(
      `SELECT 1 FROM pg_extension WHERE extname = 'vector'`,
    );
    pgvector = have.length > 0;
  }
  if (pgvector) {
    await prisma.$executeRawUnsafe(`ALTER TABLE policy_chunks ADD COLUMN IF NOT EXISTS embedding vector(${EMBED_DIM})`);
    try {
      await prisma.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS ix_policy_chunks_hnsw ON policy_chunks USING hnsw (embedding vector_cosine_ops)`,
      );
    } catch (e) {
      console.log('(Bỏ qua index HNSW:', e.message.slice(0, 80), ')');
    }
    console.log('🟢 Chế độ pgvector: BẬT (ANN search bằng SQL)');
  } else {
    console.log('🟡 Chế độ pgvector: KHÔNG có — dùng fallback JSONB + cosine trong app.');
    console.log('   Để bật pgvector thật: đổi image postgres → pgvector/pgvector:pg16 rồi `docker compose up -d postgres`, chạy lại seed này.');
  }

  // 3. Chunk + embed + upsert
  let total = 0;
  for (const doc of DOCUMENTS) {
    const chunks = chunkText(doc.body);
    await prisma.$executeRawUnsafe(`DELETE FROM policy_chunks WHERE doc_title = $1`, doc.title);
    for (let i = 0; i < chunks.length; i++) {
      const content = chunks[i];
      const values = await embedText(apiKey, content);
      const vecLiteral = `[${values.join(',')}]`;
      await prisma.$executeRawUnsafe(
        `INSERT INTO policy_chunks (doc_title, chunk_index, content, source, embedding_json${pgvector ? ', embedding' : ''})
         VALUES ($1, $2, $3, $4, $5::jsonb${pgvector ? ', $6::vector' : ''})
         ON CONFLICT (doc_title, chunk_index) DO UPDATE SET content = EXCLUDED.content, source = EXCLUDED.source, embedding_json = EXCLUDED.embedding_json${pgvector ? ', embedding = EXCLUDED.embedding' : ''}`,
        doc.title, i, content, doc.source, JSON.stringify(values), ...(pgvector ? [vecLiteral] : []),
      );
      total++;
      process.stdout.write(`\r   ${doc.title} — chunk ${i + 1}/${chunks.length}`);
    }
    process.stdout.write('\n');
  }

  const count = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS n FROM policy_chunks`);
  console.log(`\n✅ Seed xong: ${total} chunk mới, tổng ${count[0].n} chunk trong policy_chunks (pgvector: ${pgvector ? 'ON' : 'OFF'})`);
}

main()
  .catch((e) => { console.error('❌', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
