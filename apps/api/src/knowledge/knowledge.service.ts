import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

export interface KnowledgeHit {
  docTitle: string;
  chunkIndex: number;
  content: string;
  source: string | null;
  score: number;
}

const EMBED_MODEL = 'gemini-embedding-001';
const EMBED_DIM = 768;

@Injectable()
export class KnowledgeService {
  private readonly logger = new Logger(KnowledgeService.name);
  /** Cache trạng thái pgvector ( tránh query pg_extension mỗi lần search ) */
  private pgvectorMode: boolean | null = null;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  /** Gọi Gemini embedding API (1 text → vector 768 chiều) */
  private async embed(text: string): Promise<number[]> {
    const apiKey =
      this.config.get<string>('GEMINI_API_KEY') ?? '';
    if (!apiKey) throw new Error('GEMINI_API_KEY chưa cấu hình');
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: `models/${EMBED_MODEL}`,
          content: { parts: [{ text: text.slice(0, 2000) }] },
          outputDimensionality: EMBED_DIM,
        }),
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Gemini embedding HTTP ${res.status}: ${body.slice(0, 120)}`);
    }
    const json = (await res.json()) as { embedding?: { values?: number[] } };
    const values = json?.embedding?.values;
    if (!Array.isArray(values) || values.length !== EMBED_DIM) {
      throw new Error('Embedding trả về sai chiều');
    }
    return values;
  }

  /** Cosine similarity trong Node (fallback khi Postgres chưa có pgvector) */
  private cosine(a: number[], b: number[]): number {
    let dot = 0;
    let na = 0;
    let nb = 0;
    for (let i = 0; i < a.length; i++) {
      const av = a[i] ?? 0;
      const bv = b[i] ?? 0;
      dot += av * bv;
      na += av * av;
      nb += bv * bv;
    }
    if (na === 0 || nb === 0) return 0;
    return dot / (Math.sqrt(na) * Math.sqrt(nb));
  }

  private async isPgvector(): Promise<boolean> {
    if (this.pgvectorMode !== null) return this.pgvectorMode;
    try {
      const rows = await this.prisma.$queryRawUnsafe<{ extname: string }[]>(
        `SELECT extname FROM pg_extension WHERE extname = 'vector'`,
      );
      this.pgvectorMode = rows.length > 0;
    } catch {
      this.pgvectorMode = false;
    }
    this.logger.log(
      `Knowledge search mode: ${this.pgvectorMode ? 'pgvector ANN (SQL <=>)' : 'JSONB + cosine in-app fallback'}`,
    );
    return this.pgvectorMode;
  }

  /** Tìm kiếm kiến thức chính sách theo độ tương đồng ngữ nghĩa */
  async search(query: string, topK = 4): Promise<{
    mode: 'pgvector' | 'fallback-cosine';
    results: KnowledgeHit[];
  }> {
    const q = (query ?? '').trim();
    if (!q) return { mode: 'fallback-cosine', results: [] };
    const k = Math.min(Math.max(topK, 1), 10);

    const queryVec = await this.embed(q);

    if (await this.isPgvector()) {
      const vecLiteral = `[${queryVec.join(',')}]`;
      const rows = (await this.prisma.$queryRawUnsafe(
        `SELECT doc_title, chunk_index, content, source, 1 - (embedding <=> $1::vector) AS score
         FROM policy_chunks
         WHERE embedding IS NOT NULL
         ORDER BY embedding <=> $1::vector
         LIMIT $2`,
        vecLiteral,
        k,
      )) as Array<{
        doc_title: string;
        chunk_index: number;
        content: string;
        source: string | null;
        score: number;
      }>;
      return {
        mode: 'pgvector',
        results: rows.map((r) => ({
          docTitle: r.doc_title,
          chunkIndex: r.chunk_index,
          content: r.content,
          source: r.source,
          score: Number(Number(r.score).toFixed(4)),
        })),
      };
    }

    // Fallback: nạp toàn bộ chunk (nhỏ, ~vài chục) và tính cosine trong app
    const rows = (await this.prisma.$queryRawUnsafe(
      `SELECT doc_title, chunk_index, content, source, embedding_json
       FROM policy_chunks`,
    )) as Array<{
      doc_title: string;
      chunk_index: number;
      content: string;
      source: string | null;
      embedding_json: unknown;
    }>;
    const scored = rows.map((r) => {
      const emb = (r.embedding_json as number[]) ?? [];
      return {
        docTitle: r.doc_title,
        chunkIndex: r.chunk_index,
        content: r.content,
        source: r.source,
        score: Number(this.cosine(queryVec, emb).toFixed(4)),
      };
    });
    scored.sort((a, b) => b.score - a.score);
    return { mode: 'fallback-cosine', results: scored.slice(0, k) };
  }
}
