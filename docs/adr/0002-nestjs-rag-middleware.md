# ADR-0002: NestJS làm RAG middleware — n8n không kết nối DB trực tiếp cho vector search

**Ngày:** 2026-09-05  
**Trạng thái:** Accepted

## Bối cảnh

Khi HR QA Agent cần tra nội quy công ty hoặc luật lao động, có hai lựa chọn:
1. n8n dùng Postgres Vector Store node kết nối thẳng pgvector
2. HR Agent gọi tool HTTP → NestJS endpoint → NestJS thực hiện vector search

## Quyết định

Dùng **NestJS làm RAG middleware**: thêm endpoint `GET /api/v1/n8n/policy-search?query=...` vào `AiContextModule`. NestJS dùng `pgvector` extension trong PostgreSQL hiện có để thực hiện similarity search, trả về top-k chunks. HR Agent gọi qua tool `SearchHRPolicy` — pattern nhất quán với `GetEmployeeContext` và `GetPayrollContext`.

Tài liệu được embed: **nội quy công ty mẫu + trích đoạn Bộ luật Lao động 2019** (B). Embedding được tạo lúc seed/startup bằng Google Gemini Embedding API.

## Hệ quả

- ✅ Kiến trúc rõ ràng: n8n = orchestrator, NestJS = data/logic layer
- ✅ Dễ giải thích trước hội đồng bảo vệ
- ✅ Tái sử dụng pattern đã có
- ⚠️ Cần thêm `PolicyChunk` model vào Prisma schema (id, content, embedding vector, source, chunkIndex)
- ⚠️ Cần enable `pgvector` extension trong PostgreSQL Docker
- ⚠️ Cần viết seed script embed tài liệu
