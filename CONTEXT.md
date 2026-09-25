# CONTEXT.md — Hệ Thống Quản Trị Doanh Nghiệp Đa Tác Tử AI

## Glossary

**Router Agent** — Workflow n8n (WF01) nhận mọi tin nhắn đầu vào qua `POST /webhook/chat`, thực hiện PII Masking rồi dùng Gemini phân loại intent, sau đó route sang đúng sub-workflow. Không trả lời trực tiếp.

**Intent** — Nhãn phân loại mục đích của tin nhắn: `HR_QA` | `TRAINING` | `CSKH` | `OTHER`. Do Router Agent gán, không do người dùng chọn.

**HR QA Agent** — Workflow n8n (WF02) xử lý câu hỏi nội bộ về nhân sự: lương, phép, hợp đồng, luật lao động. Dùng Gemini + tool `GetEmployeeContext` + `GetPayrollContext` + `SearchHRPolicy`. Chỉ nhân viên nội bộ dùng.

**Training Agent** — Workflow n8n (WF03) mô phỏng kịch bản giao tiếp thực chiến (role-play). AI đóng vai nhân vật, đồng thời chấm điểm 4 tiêu chí: `professional`, `empathy`, `problem_solving`, `clarity`. Điểm được lưu vào `AiChatMessage.metadata`. Luồng Hybrid Assessment quiz (`POST /training/submit`) cũng chấm 4 tiêu chí này (từ 25/09): mỗi essay trả `criteria` 0–10, NestJS trung bình theo tiêu chí và lưu `TrainingSession.aiScore` (fallback `essay_avg` cho cả 4 trục khi LLM không trả criteria — xem [[24 - Audit Cơ Chế Chấm Điểm AI]]).

**CSKH Agent** — Workflow n8n (WF04) xử lý tin nhắn khách hàng qua kênh Zalo OA. AI trả lời câu hỏi đơn giản. Khi gặp vấn đề phức tạp, phát tín hiệu Escalation để nhân viên thật vào xử lý trực tiếp với khách hàng. Trong demo, transport của kênh là Slack DM (xem **Slack Transport**); kiến trúc và đặt tên vẫn là "Zalo".

**Slack Transport** — Cách demo kênh Zalo bằng Slack: khách DM bot Slack → Slack Events API `POST /webhook/zalo-webhook` → WF04 xử lý như tin Zalo (session channel vẫn là `zalo`, `externalId` = Slack user id `U…`). Câu trả lời AI được gửi qua `POST /n8n/outbound-reply` → NestJS gọi Slack Web API (`conversations.open` + `chat.postMessage`) với `SLACK_BOT_TOKEN` giữ server-side. Workflow `05-slack-verify` echo `challenge` khi đăng ký Event URL. Thiếu token → API trả `{ delivered: false, reason: 'SLACK_BOT_TOKEN_NOT_CONFIGURED' }` thay vì lỗi.

**Outbound Reply** — Endpoint nội bộ `POST /n8n/outbound-reply` (x-api-key): một cửa gửi tin ra kênh khách hàng. Cả AI (WF04) lẫn nhân viên tiếp quản (portal reply) đều đi qua `SlackService.sendSlackDm` — một nơi duy nhất quyết định cách gửi.

**Escalation** — Sự kiện khi CSKH Agent phát hiện câu hỏi vượt tầm AI (tag `[CAN_ESCALATE:]` trong output). Luồng: n8n → `POST /n8n/escalate` → tắt bot session (`isActive=false`) + tạo Notification → WebSocket emit đến Admin Portal → nhân viên tiếp quản. Metadata message lưu `escalated`, `escalateReason` (+ `summary` ngắn khi có) — queue portal hiển thị lý do ngay trong danh sách.

**Intent Stats** — Thống kê định tuyến của Router Agent: `GET /agents/intent-stats` (RBAC admin) đếm `metadata.intent` trên các message `assistant` → `{ total, byIntent: { HR_QA, CSKH, TRAINING, OTHER }, escalations }`. Hiển thị panel tỷ lệ + badge `🔀 routed` trên card WF01 trong AI Sandbox.

**Session** — Một phiên hội thoại liên tục, định danh bởi `AiChatSession.id`. Mỗi session có `type` (HR_QA / CSKH / TRAINING), `employeeId` (nullable cho CSKH Zalo), và `externalId` (Zalo userId cho kênh Zalo). Session là đơn vị lưu trữ lịch sử hội thoại trong DB.

**Message** — Một lượt nói trong Session, lưu trong `AiChatMessage`. Có `role` (`user` | `assistant`), `content`, và `metadata` (JSON tuỳ ý — dùng lưu scoring Training, model name, intent).

**Chat History (Source of Truth)** — Lịch sử hội thoại được lưu trong PostgreSQL (`AiChatMessage`). n8n đọc qua `Postgres Chat Memory` node, không dùng in-memory buffer. Tồn tại qua docker restart.

**PII Masking** — Bước che thông tin nhạy cảm (CMND 9/12 số, SĐT, email) bằng regex trong WF01 trước khi gửi lên LLM. Thông tin thật được lấy lại qua tool từ DB khi cần, không cần de-anonymize output.

**Rule Engine** — Mô-đun tính lương trong NestJS (`PayrollService.calculatePayroll()`). Dùng logic cứng (không dùng AI) cho: thuế TNCN 7 bậc lũy tiến, BHXH/BHYT/BHTN, OT x1.5/x2.0/x3.0. Đảm bảo chính xác tuyệt đối cho dữ liệu tài chính.

**Bulk Approval** — Duyệt/thanh toán nhiều phiếu lương một lượt: `POST /payroll/approve-bulk` & `POST /payroll/paid-bulk` nhận `{ ids?, month?, year? }` (ids ưu tiên, không có ids → toàn bộ kỳ). Chỉ DRAFT→APPROVED (approve) và APPROVED→PAID (paid). UI: checkbox từng dòng + chọn tất cả trên Bảng Lương, dialog xác nhận đếm số phiếu.

**Geofence** — Vùng địa lý cho phép check-in/out GPS: model `OfficeGeofence` (bản ghi đơn `default`: name, lat, lng, radiusM). HR_ADMIN sửa tại Trang Cài Đặt (`PATCH /settings/geofence`); ESS đọc `GET /settings/geofence` trước khi so Haversine. Thay thế cấu hình env `NEXT_PUBLIC_OFFICE_*` (vẫn làm fallback).

**Settings Page** — Trang "Cài Đặt Hệ Thống" (chỉ HR_ADMIN/ADMIN, gate cả nav lẫn `RolesGuard`): (1) Cấu hình lương & thuế theo năm (`POST /salary-config`); (2) Geofence chấm công; (3) Trạng thái tích hợp `GET /settings/integrations` — ping thật PostgreSQL/n8n healthz/Slack auth.test/Gemini models, trả `ok | error | not_configured` + latency.

**Profile (5 nhóm)** — Drawer hồ sơ nhân viên: Hồ sơ cá nhân (sửa được: phone/address/dob/CCCD qua `PATCH /employees/:id`), Nghề vụ & HĐLĐ (phòng ban, chức danh, quản lý trực tiếp, hợp đồng active + lương), Công & phép (phép năm + tổng hợp chấm công tháng), Lịch sử lương (`GET /payroll/employee/:id`), Trạng thái & tài khoản (email đăng nhập + switcher `PATCH /employees/:id/status` với enum validate: `ACTIVE | PROBATION | ON_LEAVE | TERMINATED`).

**RAG (Retrieval-Augmented Generation)** — Kỹ thuật bổ sung context từ knowledge base vào prompt LLM. *(Đã triển khai 14/09)*: HR QA Agent dùng tool `SearchPolicyKnowledge` → gọi NestJS `GET|POST /n8n/knowledge-search?query=&topK=` → embedding query bằng Gemini `gemini-embedding-001` (768 dims) → similarity search trên bảng `policy_chunks` (dual-mode: pgvector ANN `<=>` khi có extension, fallback cosine in-app trên JSONB) → trả về top-k chunks chính sách (lương/OT, BHXH, thuế TNCN, phép, escalation, PII…) để AI trích dẫn khi trả lời. Seed: `packages/database/scripts/seed-knowledge.cjs`.

**Scenario** — Kịch bản role-play trong Training Agent. 6 loại: `customer_complaint`, `colleague_conflict`, `manager_feedback`, `new_employee_onboarding`, `performance_review`, `general_communication`. Do client truyền trực tiếp qua `body.scenarioType` (Web Portal — view My Training; Mobile client là hướng phát triển), không cần AI detect.

**Tool** — Trong ngữ cảnh AI Agent n8n: một HTTP Request node được kết nối vào AI Agent qua cổng `ai_tool`. Agent tự quyết định khi nào gọi tool và với tham số gì (dùng `$fromAI()`). WF02 có 3 tools: `GetEmployeeContext`, `GetPayrollContext`, `SearchPolicyKnowledge` (RAG — 14/09).

**Human-in-the-loop** — Pattern trong WF04: AI xử lý trước, khi vượt tầm thì chuyển sang con người. Nhân viên (được chỉ định bởi cấp trên) tiếp quản hội thoại trực tiếp với khách hàng trên Zalo OA.

**x-api-key / HR_API_KEY** — Header xác thực dùng để n8n gọi NestJS internal endpoints (`/api/v1/n8n/*`). Được guard bởi `ApiKeyGuard`. Không phải JWT — không cần login.

**ADMIN** — Role dành cho quản trị viên hệ thống. Có toàn quyền truy cập 7 phân hệ quản trị (Dashboard, Nhân Sự, Bảng Lương, AI Agents, CSKH Escalation, Đào Tạo, Cài Đặt). Hệ thống chỉ còn 2 role: `ADMIN` và `EMPLOYEE`. Hàm `isAdminRole()` trong `@repo/shared-types` trả về `true` chỉ khi role là `ADMIN`.

**Firebase Auth** — Dịch vụ xác thực của Google Firebase (client SDK `firebase/auth`). Xử lý OAuth flow Google/Facebook trên frontend, trả về `idToken`. Frontend gửi `idToken` lên `POST /api/v1/auth/firebase` → NestJS dùng `firebase-admin` SDK verify token → tạo JWT nội bộ kèm `role`. Whitelist-only: chỉ `email` đã tồn tại trong DB mới được phép login.

**OAuth Whitelist** — Chính sách bảo mật: người dùng OAuth (Google/Facebook) chỉ đăng nhập được nếu `email` của họ đã được HR_ADMIN tạo trước trong DB. Không có tự đăng ký. Nếu email không trong whitelist, backend trả 403 với thông báo "Tài khoản chưa được cấp quyền truy cập".

**Remember Me** — Cơ chế lưu session Firebase: nếu người dùng check "Nhớ đăng nhập 30 ngày" → `setPersistence(browserLocalPersistence)`; không check → `setPersistence(browserSessionPersistence)` (mất khi đóng tab). JWT của NestJS luôn có expiry 30 ngày. Session được lưu trong `localStorage`.

