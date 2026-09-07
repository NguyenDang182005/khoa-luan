---
tags: [khoa-luan, n8n, nestjs, e2e-testing, gemini-2.5-flash, multi-agent, audit-trail]
created: 2026-09-07
status: completed
---

# 📝 Nhật Ký Tích Hợp n8n & NestJS — Kiểm Thử E2E Multi-Agent

> **Ngày thực hiện:** 07/09/2026  
> **Trạng thái:** ✅ **Hoàn thành 100% — Kiểm thử E2E thông luồng thành công**  
> **Mô hình AI sử dụng:** `models/gemini-2.5-flash` (Hạn mức ổn định 1.500 requests/ngày)  
> **Môi trường:** NestJS API chạy trực tiếp trên Host (Port 3001), Docker (PostgreSQL 5432, n8n 5678, pgAdmin 5050)

---

## 1. Mục Tiêu & Phạm Vi Công Việc

Kết nối thành công backend NestJS (`apps/api`) với hệ thống điều phối 4 AI Agent trên **n8n**, giải quyết toàn bộ các lỗi kết nối/xác thực/mô hình AI, và chạy kiểm thử End-to-End (E2E) đa lượt (multi-turn) từ Router Agent đến cả 3 sub-agent (HR QA, Training, CSKH).

---

## 2. Các Lỗi Kỹ Thuật Đã Xử Lý & Giải Pháp

### 2.1. Lựa Chọn Chuẩn Mô Hình: Google Gemini 2.5 Flash
- **Bối cảnh & Vấn đề Quota:**
  - Ban đầu thử nghiệm nâng cấp lên `models/gemini-3.5-flash` (bản preview mới nhất). Tuy nhiên, trên Google AI Studio Free Tier, model 3.5-flash bị giới hạn ngặt nghèo ở mức **20 requests/ngày** (`429 Quota exceeded: limit: 20 per day, model: gemini-3.5-flash`).
  - Trong khi đó, **`models/gemini-2.5-flash`** có hạn mức rộng rãi **1.500 requests/ngày** (15 RPM), phản hồi nhanh chóng (~3-5s), hỗ trợ đầy đủ Tool Calling và Thinking Mode.
- **Giải pháp:** Thiết lập đồng bộ cả 4 workflows sang **`models/gemini-2.5-flash`**, đảm bảo hệ thống có thể chạy test liên tục và demo mượt mà mà không sợ cạn kiệt quota.

### 2.2. Khắc Phục Lỗi Cạn Token Do Cơ Chế "Thinking"
- **Nguyên nhân:** Các model thế hệ mới của Gemini (2.5 và 3.5) mặc định kích hoạt cơ chế suy luận ngầm (*Thinking*), tiêu tốn khoảng ~200 – 300 tokens trước khi sinh nội dung văn bản.
- Trước đó, trong node `Gemini` của `01-router-agent.json`, tham số `maxOutputTokens` bị gán cứng là **`20`**.
- Hậu quả: Model chạm trần 20 token ngay khi đang suy nghĩ, trả về `content: undefined`, khiến LangChain Parser của n8n văng lỗi `TypeError: Cannot read properties of undefined (reading 'content')`.
- **Giải pháp:** Nâng `maxOutputTokens` lên **`1024`** cho tất cả các node Gemini trong hệ thống.

### 2.3. Sửa Lỗi SSL Của Postgres Chat Memory
- **Nguyên nhân:** Khi n8n nạp credential Postgres với `"ssl": false` (kiểu boolean), module kết nối của n8n kiểm tra điều kiện `!['disable', undefined].includes(credentials.ssl)`. Boolean `false` không nằm trong danh sách chuỗi hợp lệ nên n8n tự động kích hoạt SSL, gây ra lỗi:  
  `NodeOperationError: The server does not support SSL connections`.
- **Giải pháp:** Cấu hình chuẩn xác `"ssl": "disable"` trong credential `HR System PostgreSQL` (ID: `DImvfbYdTqnryV2B`).

### 2.4. Khắc Phục Webhook Router Trả Về Body Rỗng
- **Nguyên nhân:** Node `Webhook /chat` có `responseMode: "responseNode"`. Khi Router chuyển tiếp request sang các node `Execute Workflow` gọi sub-workflow, các nhánh này chưa được nối với node `Respond to Webhook` ở workflow cha, dẫn đến kết thúc workflow mà không có body trả về (Status 200, Body: `""`).
- **Giải pháp:**
  - Bổ sung node `Respond Chat Webhook` (`n8n-nodes-base.respondToWebhook` với `respondWith: "firstIncomingItem"`) ở `01-router-agent.json`.
  - Kết nối cả 3 nhánh `Execute HR Q&A Agent`, `Execute Training Agent`, `Execute CSKH Agent` về node này.
  - Bổ sung node `Format Output` tại các sub-workflow để chuẩn hóa định dạng JSON trả về `{ answer, sessionId, employeeId, intent }`.

### 2.5. Chuyển Đổi AI Tool Sang Chuẩn LangChain
- **Nguyên nhân:** Node HTTP Request thông thường (`n8n-nodes-base.httpRequest`) không có cổng `supplyData` dành cho AI Agent trong LangChain.
- **Giải pháp:** Chuyển đổi thành `@n8n/n8n-nodes-langchain.toolHttpRequest`:
  - `GetEmployeeContext`: URL placeholder `http://host.docker.internal:3001/api/v1/n8n/employee-context/{employee_id}`
  - `GetPayrollContext`: URL placeholder `http://host.docker.internal:3001/api/v1/n8n/payroll-context/{employee_id}` kèm query parameter `month`, `year`
  - Xác thực bảo mật: Generic Credential `httpHeaderAuth` (`HR API Key Header`, header: `x-api-key`).

### 2.6. Tiêm Ngữ Cảnh Định Danh Nhân Viên (Context Injection)
- **Giải pháp:** Đưa thông tin mã nhân viên đang đăng nhập vào prompt đầu vào của `HR Agent`:  
  `[Thong tin nguoi dung - Ma nhan vien: EMP003]`  
  Giúp AI nhận diện ngay danh tính nhân sự và tự động gọi tool tra cứu mà không cần hỏi lại người dùng.

---

## 3. Kết Quả Kiểm Thử E2E (End-to-End Test)

### 🎯 Lượt 1: Tra Cứu Lương Tháng 8/2026 Của `EMP003` (WF01 Router -> WF02 HR QA)
- **Request:**
  ```http
  POST http://127.0.0.1:5678/webhook/chat
  Content-Type: application/json

  {
    "message": "Lương tháng 8/2026 của tôi là bao nhiêu?",
    "channel": "web",
    "employeeId": "EMP003"
  }
  ```
- **Hành trình xử lý:**
  1. `01 - Router Agent`: Phân loại Intent chính xác là `HR_QA`.
  2. Router kích hoạt `02 - HR Q&A Agent` qua `Execute Workflow Trigger`.
  3. WF02 gọi NestJS `POST /api/v1/n8n/chat/session` -> Lấy/Tạo session ID.
  4. WF02 gọi NestJS `POST /api/v1/n8n/chat/message` -> Lưu tin nhắn của User.
  5. `HR Agent` (Gemini 2.5 Flash) tự động gọi tool `GetPayrollContext` qua NestJS API `http://host.docker.internal:3001/api/v1/n8n/payroll-context/EMP003?month=8&year=2026`.
  6. AI nhận dữ liệu lương và sinh câu trả lời chi tiết.
  7. WF02 lưu phản hồi Assistant vào NestJS và trả về Router.
- **Response JSON nhận được:**
  ```json
  {
    "answer": "Tổng lương tháng 8/2026 của bạn là 29.885.544 VNĐ.",
    "sessionId": "cmtr34s5h0007tl20t5pv84li",
    "employeeId": "EMP003",
    "intent": "HR_QA"
  }
  ```
  *(Số liệu khớp 100% từng đồng với bản ghi trong cơ sở dữ liệu PostgreSQL).*

---

### 🎯 Lượt 2: Hội Thoại Tiếp Nối (Multi-turn Context)
- **Request:**
  ```http
  POST http://127.0.0.1:5678/webhook/chat
  Content-Type: application/json

  {
    "message": "Thế còn số ngày phép năm còn lại của tôi?",
    "channel": "web",
    "employeeId": "EMP003",
    "sessionId": "cmtr34s5h0007tl20t5pv84li"
  }
  ```
- **Hành trình xử lý:**
  1. `Postgres Chat Memory` khôi phục lịch sử hội thoại của session `cmtr34s5h0007tl20t5pv84li` từ bảng `n8n_chat_histories`.
  2. `HR Agent` nhận diện câu hỏi tiếp nối về ngày phép, gọi tool `GetEmployeeContext` lấy thông tin nhân sự của `EMP003`.
  3. AI trích xuất thông tin: Họ tên **Nguyễn Văn An**, ngày phép còn lại: **12 ngày**.
- **Response JSON nhận được:** Phản hồi chính xác còn 12 ngày phép.

---

### 🎯 Kiểm Thử WF03: Training Role-play Agent
- **Kịch bản:** `customer_complaint` (Khách hàng phàn nàn dịch vụ).
- **Kết quả:** Gemini 2.5 Flash khởi tạo buổi đào tạo đóng vai, xác định mục tiêu và cung cấp bộ quy tắc xử lý khiếu nại (Status 200, phản hồi ~4.9s).

---

### 🎯 Kiểm Thử WF04: Zalo OA CSKH Agent
- **Cơ chế:** Phản hồi webhook tức thì (`responseMode: "onReceived"` -> Status 200 `{"message": "Workflow was started"}`), tiếp nhận hội thoại và tương tác qua Zalo OpenAPI.

---

## 4. Xác Minh Audit Trail Trên Database

- Toàn bộ các lượt đối thoại của User và Assistant đều được lưu đầy đủ vào bảng `ai_chat_messages`.
- Metadata ghi nhận model `gemini-2.5-flash` và intent tương ứng.
- n8n Postgres Memory lưu trữ đồng thời trong bảng `n8n_chat_histories`.

---

## 5. Danh Sách Script Đã Xây Dựng

- `scripts/setup-n8n.mjs`: Script cấu hình tự động toàn diện (Credentials + Workflows import + Publish).
- `scripts/patch-all-workflows.mjs`: Script patch đồng bộ model `gemini-2.5-flash`, `maxOutputTokens`, và các node phản hồi.
- `scripts/test-e2e.mjs`: Test suite chạy tự động kiểm thử Lượt 1.
- `scripts/test-e2e-turn2.mjs`: Test suite chạy tự động kiểm thử Lượt 2.
- `scripts/test-wf03.mjs`: Test suite chạy kiểm thử WF03 Training Agent.
- `scripts/test-reset-behavior.mjs`: Test suite kiểm thử tự động luồng Escalate, Mute bot và Tự động Reset sau 12h đêm (5/5 bài test thành công 100%).

---

*Ghi chú liên kết:* [[06 - n8n Workflows & AI Agents]] | [[02 - Backend NestJS (API)]] | [[09 - Task Checklist]] | [[11 - Định Hướng Phát Triển Sản Phẩm (Web & Mobile)]]
