# ADR-0001: PostgreSQL là nguồn sự thật duy nhất cho lịch sử hội thoại AI

**Ngày:** 2026-09-05  
**Trạng thái:** Accepted

## Bối cảnh

n8n cung cấp `memoryBufferWindow` (Window Buffer Memory) để AI Agent lưu lịch sử hội thoại in-memory. Đồng thời, kiến trúc dự án đã có `AiChatMessage` model trong PostgreSQL và NestJS endpoint `POST /n8n/chat/message` để lưu từng tin nhắn.

Dùng cả hai song song tạo ra hai nguồn dữ liệu không đồng bộ: in-memory buffer mất khi n8n restart, DB vẫn còn — gây inconsistency nghiêm trọng.

## Quyết định

Dùng **Postgres Chat Memory node** của n8n kết nối thẳng vào PostgreSQL của project làm nguồn lịch sử hội thoại duy nhất. Bỏ `memoryBufferWindow`. n8n đọc và ghi history qua node này, dùng `sessionId` làm session key.

NestJS vẫn expose `POST /n8n/chat/message` để save message (audit trail từ phía app), nhưng không còn là nguồn mà AI Agent đọc history.

## Hệ quả

- ✅ Lịch sử tồn tại qua docker restart
- ✅ Một nguồn sự thật — không cần sync
- ✅ Admin Portal có thể đọc history qua NestJS API
- ⚠️ Cần cấu hình credential PostgreSQL trong n8n
- ⚠️ n8n tạo table riêng (`n8n_chat_histories`) trong DB — cần phân biệt với `AiChatMessage`
