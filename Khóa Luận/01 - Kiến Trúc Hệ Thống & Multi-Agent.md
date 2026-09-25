---
tags: [khoa-luan, architecture, multi-agent, ai, n8n]
created: 2026-09-04
updated: 2026-09-25
---

# 🤖 Kiến Trúc Hệ Thống & Multi-Agent

## Tổng Quan Kiến Trúc

Hệ thống theo mô hình **Client-Server** phân tách rõ ràng, quản lý dưới dạng **Monorepo**.

```
[Client (Web Portal / Zalo)] ► [n8n Router Agent] ─► [HR Q&A Agent]
                         ├► [Training Agent]
                         └► [CSKH Zalo Agent] ► [Zalo OA]
                   │
                   ▼ (Webhook)
              [NestJS API] ► [PostgreSQL DB]
                   │
                   ▼ (WebSocket)
              [Web Portal Admin]
```

---

## 4 Điểm Nhấn Công Nghệ Đột Phá

### 2.1 📡 Router Agent (Phân loại ý định)

- **Vai trò:** "Tổng đài viên thông minh" — Webhook `POST /webhook/chat`
- **Thiết kế:** Khung **PEAS** (Performance, Environment, Actuators, Sensors)
- **Flow (refactor 17/09 — 0 LLM call):**
  1. Nhận message từ client (Web Portal / Zalo OA)
  2. **PII Masking** — che thông tin nhạy cảm (Regex)
  3. **Keyword Intent Classifier** — phân loại bằng JavaScript regex thuần túy (không gọi Gemini)
  4. Switch router → route tới đúng agent
- **Output intent:** `HR_QA` | `TRAINING` | `CSKH` | `OTHER` (static message)

> [!NOTE]
> **Lý do bỏ Gemini Intent Classifier (17/09):** Free-tier giới hạn 15 RPM. Mỗi request tốn 1 LLM call cho classifier + 2-4 cho sub-agent = 3-7 calls/request. Sau refactor: 0 + 1-3 = **1-3 calls/request** (-50–66% quota).

### 2.2 👥 Nhóm Tác Tử Nghiệp Vụ

#### 💼 HR Agent (Nội bộ)
- **Lương/thưởng** → **Rule Engine** (lập trình cứng) → chính xác tuyệt đối
- **Hỏi đáp luật lao động** → **RAG + pgvector**: kho tri thức `policy_chunks` (embedding Gemini 768 dims) + tool `SearchPolicyKnowledge`
- **maxIterations: 3** (giảm từ 5, 17/09)
- Flow n8n: Lấy context nhân viên → Session → Gemini + system prompt → Lưu message

#### 📚 Training Agent (Nội bộ)
- **Đóng vai AI (Role-play Simulation):** Nhân viên thực hành kịch bản giả lập
- **Kịch bản:** `customer_complaint` | `colleague_conflict` | `manager_feedback`
- **Chấm điểm** 4 tiêu chí: Professional, Empathy, Problem-solving, Clarity

#### 📞 CSKH Agent (Ngoại bộ — Zalo OA)
- Giao tiếp với khách hàng qua **Zalo OA** thông qua n8n
- **Human-in-the-loop:** Khi phát hiện khiếu nại phức tạp:
  1. n8n bắn **Webhook** → NestJS Backend
  2. NestJS đẩy **WebSocket notification** → Web Portal
  3. HR Admin tiếp quản hội thoại

### 2.3 🔐 PII Anonymization

- **Vị trí:** WF01 Code node (trước phân loại intent)
- **Quy trình:** Regex masking (số CCCD, số điện thoại, email) → LLM chỉ thấy `maskedMessage`
- Sau refactor 17/09: cả Intent Classifier và Direct Answer cũ đều bị xóa → **không có LLM nào trong WF01 thấy dữ liệu chưa mask**

### 2.4 ⚡ WebSocket Real-time

- NestJS dùng `@nestjs/websockets` + `socket.io`
- Real-time notification cho Admin khi có khiếu nại CSKH

---

## LLM Sử Dụng

| Agent | LLM | Ghi chú |
|-------|-----|----------|
| Router (WF01) | ❌ Không dùng LLM | Keyword classifier (refactor 17/09) |
| HR Q&A (WF02) | Google Gemini 3.1 Flash Lite | RAG + employee context, maxIterations: 3 |
| Training (WF03) | Google Gemini 3.1 Flash Lite | Role-play + scoring + quiz gen/grade |
| CSKH Zalo (WF04) | Google Gemini 3.1 Flash Lite | Customer support (Slack transport) |
| Embedding | Gemini `gemini-embedding-001` | 768 dims — index `policy_chunks` |

**API Key:** Google AI Studio (free tier: 15 RPM, 500 req/ngày)

---

*Liên kết:* [[00 - Tổng Quan Dự Án]] | [[06 - n8n Workflows & AI Agents]]
