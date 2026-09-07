---
tags: [khoa-luan, n8n, ai-agents, workflow, gemini, zalo, gemini-2.5-flash]
created: 2026-09-04
updated: 2026-09-07
---

# 🤖 n8n Workflows & AI Agents

## Tổng Quan

**n8n** là nền tảng điều phối (orchestration) kết nối các AI Agent, chạy qua **Docker** tại `http://localhost:5678`.
Hệ thống sử dụng mô hình **Google Gemini 2.5 Flash** (`models/gemini-2.5-flash`) cho toàn bộ 4 Agent, với tham số `maxOutputTokens: 1024` đảm bảo cơ chế suy luận ngầm (*Thinking*) hoạt động tối ưu.

> [!NOTE]
> **Lựa chọn mô hình `gemini-2.5-flash` thay vì `gemini-3.5-flash`:**
> Bản xem trước `gemini-3.5-flash` trên Google AI Studio Free Tier bị giới hạn cứng chỉ **20 requests/ngày** (gây lỗi `429 Quota exceeded` khi test hệ thống multi-agent). Trong khi đó, **`gemini-2.5-flash`** cung cấp hạn mức **1.500 requests/ngày** (15 RPM), phản hồi cực nhanh (~3-5s), hỗ trợ đầy đủ Tool Calling và Thinking Mode, hoàn toàn phù hợp cho môi trường kiểm thử và vận hành đồ án.

Thư mục lưu trữ: `n8n-workflows/` — gồm **4 workflows JSON** đã được cấu hình credentials, dual-trigger và published lên n8n.

---

## Kiến Trúc Điều Phối & Tích Hợp

```mermaid
graph TD
    Client[Client / Webhook POST /webhook/chat] --> WF01[01 - Router Agent]
    WF01 --> PII[PII Masking]
    PII --> Intent[Intent Classifier<br/>Gemini 2.5 Flash]
    Intent --> Switch{Route by Intent}
    
    Switch -->|HR_QA| WF02[02 - HR Q&A Agent]
    Switch -->|TRAINING| WF03[03 - Training Role-play Agent]
    Switch -->|CSKH| WF04[04 - Zalo OA CSKH Agent]
    Switch -->|OTHER| RespOther[Respond OTHER]
    
    WF02 --> RespAll[Respond Chat Webhook]
    WF03 --> RespAll
    WF04 --> RespAll
    RespAll --> ClientResponse[JSON Response { answer, sessionId, employeeId, intent }]
    
    subgraph Backend NestJS
        HostAPI[http://host.docker.internal:3001]
        WF02 -.->|Tool: GetEmployeeContext| HostAPI
        WF02 -.->|Tool: GetPayrollContext| HostAPI
        WF02 -.->|Session & Msg Tracking| HostAPI
    end
```

---

## Workflow 01 — Router Agent 📡

- **Webhook endpoint:** `POST /webhook/chat`
- **Model:** `models/gemini-2.5-flash` (Temperature: 0.0, maxOutputTokens: 1024)
- **Cơ chế:** Phân loại câu hỏi sang một trong 4 nhãn: `HR_QA`, `TRAINING`, `CSKH`, `OTHER`.
- **Cơ chế phản hồi:** Nhận output từ sub-workflow qua `Execute Workflow` node và phản hồi trực tiếp cho client qua node `Respond Chat Webhook` (`firstIncomingItem`).

---

## Workflow 02 — HR Q&A Agent 💼

- **Kích hoạt (Dual-Trigger):** 
  - Trực tiếp qua `POST /webhook/hr-qa`
  - Hoặc từ Router qua `Execute Workflow Trigger`
- **Model:** `models/gemini-2.5-flash` (Temperature: 0.3, maxOutputTokens: 1024, maxIterations: 5)
- **Bộ nhớ hội thoại:** `Postgres Chat Memory` kết nối bảng `n8n_chat_histories` trên PostgreSQL (`ssl: disable`).
- **AI Tools (LangChain `toolHttpRequest`):**
  - `GetEmployeeContext`: `http://host.docker.internal:3001/api/v1/n8n/employee-context/{employee_id}`
  - `GetPayrollContext`: `http://host.docker.internal:3001/api/v1/n8n/payroll-context/{employee_id}?month=&year=`
  - Xác thực bảo mật: Generic Credential `httpHeaderAuth` (`x-api-key`).
- **Lưu vết:** Tự động đồng bộ tin nhắn User và Assistant vào bảng `ai_chat_messages` trên NestJS.

---

## Workflow 03 — Training Role-play Agent 🎮

- **Kích hoạt:** `Execute Workflow Trigger` từ Router
- **Model:** `models/gemini-2.5-flash` (Temperature: 0.8, maxOutputTokens: 1024)
- **Kịch bản (6 Scenarios):** `customer_complaint`, `colleague_conflict`, `manager_feedback`, `new_employee_onboarding`, `performance_review`, `general_communication`.
- **Đánh giá tự động:** Chấm điểm 4 tiêu chí qua tag `[DANH GIA: chuyên nghiệp, đồng cảm, giải quyết, rõ ràng]`.
- **Bộ nhớ:** `Postgres Chat Memory` đa lượt hội thoại.

---

## Workflow 04 — Zalo OA CSKH Agent 📞

- **Kích hoạt (Dual-Trigger):** Webhook `POST /webhook/zalo-webhook` hoặc từ Router qua `Execute Workflow Trigger`
- **Model:** `models/gemini-2.5-flash` (Temperature: 0.5, maxOutputTokens: 1024)
- **Cơ chế Escalation:** Tự động phát hiện khiếu nại nghiêm trọng qua tag `[CAN_ESCALATE:]`, gọi NestJS `POST /api/v1/n8n/escalate` để đẩy thông báo real-time qua WebSocket cho Admin.
- **Tiếp nhận Webhook Zalo:** Chế độ `responseMode: "onReceived"` phản hồi HTTP 200 tức thì cho server Zalo, xử lý LLM và gửi tin nhắn phản hồi qua Zalo OpenAPI.

---

## Script Triển Khai & Kiểm Thử

| Script | Công dụng |
|---|---|
| `scripts/setup-n8n.mjs` | Tự động import credentials và publish 4 workflows |
| `scripts/patch-all-workflows.mjs` | Đồng bộ hóa cấu hình model Gemini 2.5 Flash & response nodes |
| `scripts/test-e2e.mjs` | Chạy kiểm thử E2E Lượt 1 (Hỏi lương) |
| `scripts/test-e2e-turn2.mjs` | Chạy kiểm thử E2E Lượt 2 (Hỏi ngày phép multi-turn) |
| `scripts/test-wf03.mjs` | Chạy kiểm thử WF03 Training Role-play Agent |
| `scripts/test-reset-behavior.mjs` | Kiểm thử luồng Escalate, Mute bot & Tự động Reset sau 12h đêm |

---

*Liên kết chi tiết:* [[10 - Nhật Ký Tích Hợp n8n & NestJS (E2E Test)]] | [[01 - Kiến Trúc Hệ Thống & Multi-Agent]] | [[09 - Task Checklist]] | [[11 - Định Hướng Phát Triển Sản Phẩm (Web & Mobile)]]
