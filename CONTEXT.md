# CONTEXT.md — Hệ Thống Quản Trị Doanh Nghiệp Đa Tác Tử AI

## Glossary

**Router Agent** — Workflow n8n (WF01) nhận mọi tin nhắn đầu vào qua `POST /webhook/chat`, thực hiện PII Masking rồi dùng Gemini phân loại intent, sau đó route sang đúng sub-workflow. Không trả lời trực tiếp.

**Intent** — Nhãn phân loại mục đích của tin nhắn: `HR_QA` | `TRAINING` | `CSKH` | `OTHER`. Do Router Agent gán, không do người dùng chọn.

**HR QA Agent** — Workflow n8n (WF02) xử lý câu hỏi nội bộ về nhân sự: lương, phép, hợp đồng, luật lao động. Dùng Gemini + tool `GetEmployeeContext` + `GetPayrollContext` + `SearchHRPolicy`. Chỉ nhân viên nội bộ dùng.

**Training Agent** — Workflow n8n (WF03) mô phỏng kịch bản giao tiếp thực chiến (role-play). AI đóng vai nhân vật, đồng thời chấm điểm 4 tiêu chí: `professional`, `empathy`, `problem_solving`, `clarity`. Điểm được lưu vào `AiChatMessage.metadata`.

**CSKH Agent** — Workflow n8n (WF04) xử lý tin nhắn khách hàng qua Zalo OA. AI trả lời câu hỏi đơn giản. Khi gặp vấn đề phức tạp hoặc được chỉ định bởi cấp trên, phát tín hiệu Escalation để nhân viên thật vào xử lý trực tiếp với khách hàng.

**Escalation** — Sự kiện khi CSKH Agent phát hiện câu hỏi vượt tầm AI (tag `[CAN_ESCALATE:]` trong output). Luồng: n8n → `POST /n8n/escalate` → NestJS tạo Notification → WebSocket emit đến Admin Portal → nhân viên tiếp quản.

**Session** — Một phiên hội thoại liên tục, định danh bởi `AiChatSession.id`. Mỗi session có `type` (HR_QA / CSKH / TRAINING), `employeeId` (nullable cho CSKH Zalo), và `externalId` (Zalo userId cho kênh Zalo). Session là đơn vị lưu trữ lịch sử hội thoại trong DB.

**Message** — Một lượt nói trong Session, lưu trong `AiChatMessage`. Có `role` (`user` | `assistant`), `content`, và `metadata` (JSON tuỳ ý — dùng lưu scoring Training, model name, intent).

**Chat History (Source of Truth)** — Lịch sử hội thoại được lưu trong PostgreSQL (`AiChatMessage`). n8n đọc qua `Postgres Chat Memory` node, không dùng in-memory buffer. Tồn tại qua docker restart.

**PII Masking** — Bước che thông tin nhạy cảm (CMND 9/12 số, SĐT, email) bằng regex trong WF01 trước khi gửi lên LLM. Thông tin thật được lấy lại qua tool từ DB khi cần, không cần de-anonymize output.

**Rule Engine** — Mô-đun tính lương trong NestJS (`PayrollService.calculatePayroll()`). Dùng logic cứng (không dùng AI) cho: thuế TNCN 7 bậc lũy tiến, BHXH/BHYT/BHTN, OT x1.5/x2.0/x3.0. Đảm bảo chính xác tuyệt đối cho dữ liệu tài chính.

**RAG (Retrieval-Augmented Generation)** — Kỹ thuật bổ sung context từ knowledge base vào prompt LLM. Trong dự án: HR QA Agent dùng tool `SearchHRPolicy` → gọi NestJS `GET /n8n/policy-search?query=...` → pgvector similarity search trong PostgreSQL → trả về chunks liên quan từ nội quy công ty và Bộ luật Lao động 2019.

**Scenario** — Kịch bản role-play trong Training Agent. 6 loại: `customer_complaint`, `colleague_conflict`, `manager_feedback`, `new_employee_onboarding`, `performance_review`, `general_communication`. Do Mobile App truyền trực tiếp qua `body.scenarioType`, không cần AI detect.

**Tool** — Trong ngữ cảnh AI Agent n8n: một HTTP Request node được kết nối vào AI Agent qua cổng `ai_tool`. Agent tự quyết định khi nào gọi tool và với tham số gì (dùng `$fromAI()`). WF02 có 3 tools: `GetEmployeeContext`, `GetPayrollContext`, `SearchHRPolicy`.

**Human-in-the-loop** — Pattern trong WF04: AI xử lý trước, khi vượt tầm thì chuyển sang con người. Nhân viên (được chỉ định bởi cấp trên) tiếp quản hội thoại trực tiếp với khách hàng trên Zalo OA.

**x-api-key / HR_API_KEY** — Header xác thực dùng để n8n gọi NestJS internal endpoints (`/api/v1/n8n/*`). Được guard bởi `ApiKeyGuard`. Không phải JWT — không cần login.
