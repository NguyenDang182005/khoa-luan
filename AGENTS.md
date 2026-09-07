# Repository Instructions & Working Rules

## 1. Quy tắc đồng bộ Obsidian (Obsidian Synchronization Rule)
- **BẮT BUỘC:** Khi làm việc trong repo này, mỗi khi hoàn thành và kiểm thử (test) tính năng ổn định, **PHẢI hỏi người dùng**:
  > *"Tính năng/kết quả kiểm thử đã chạy ổn định, bạn có muốn lưu lại vào Obsidian không?"*
- Khi người dùng xác nhận hoặc yêu cầu, cập nhật đầy đủ vào thư mục `Khóa Luận/` và đồng bộ qua Obsidian MCP tool.

## 2. Tiêu chuẩn công nghệ
- **Backend:** NestJS 11 (Port 3001), PostgreSQL (Port 5432), Prisma Client.
- **Workflow & AI:** n8n (Port 5678), Google Gemini 3.5 Flash (`maxOutputTokens: 1024`).
- **Giao tiếp n8n ↔ NestJS:** Header `x-api-key`.
