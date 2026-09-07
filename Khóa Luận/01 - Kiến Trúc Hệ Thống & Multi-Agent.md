---
tags: [khoa-luan, architecture, multi-agent, ai, n8n]
created: 2026-09-04
---

# 🤖 Kiến Trúc Hệ Thống & Multi-Agent

## Tổng Quan Kiến Trúc

Hệ thống theo mô hình **Client-Server** phân tách rõ ràng, quản lý dưới dạng **Monorepo**.

```
[Mobile App] ───► [n8n Router Agent] ──► [HR Q&A Agent]
                              ├──► [Training Agent]
                              └──► [CSKH Zalo Agent] ─► [Zalo OA]
                        │
                        ▼ (Webhook)
                   [NestJS API] ──► [PostgreSQL DB]
                        │
                        ▼ (WebSocket)
                   [Web Portal Admin]
```

---

## 4 Điểm Nhấn Công Nghệ Đột Phá

### 2.1 📡 Router Agent (Phân loại ý định)

- **Vai trò:** "Tổng đài viên thông minh" — Webhook `POST /webhook/chat`
- **Thiết kế:** Khung **PEAS** (Performance, Environment, Actuators, Sensors)
- **Flow:**
  1. Nhận message từ Mobile App
  2. **PII Masking** — che thông tin nhạy cảm (Regex + NER)
  3. **Gemini Intent Detection** — phân loại ngữ nghĩa
  4. Switch router → route tới đúng agent
- **Output intent:** `HR_QA` | `TRAINING` | `CSKH`

### 2.2 👥 Nhóm Tác Tử Nghiệp Vụ

#### 💼 HR Agent (Nội bộ)
- **Lương/thưởng** → **Rule Engine** (lập trình cứng) → chính xác tuyệt đối
- **Hỏi đáp luật lao động** → **GraphRAG** (Knowledge Graph) → hiểu liên kết logic giữa hợp đồng & nội quy, trích dẫn nguồn
- Flow n8n: Lấy context nhân viên → Session → Gemini + system prompt → Lưu message

#### 📚 Training Agent (Nội bộ)
- **Đóng vai AI (Role-play Simulation):** Nhân viên thực hành kịch bản giả lập trên điện thoại
- **Phiên bản:** `customer_complaint` | `colleague_conflict` | `manager_feedback`
- **Chấm điểm** 4 tiêu chí: Professional, Empathy, Problem-solving, Clarity
- Dùng **Sentiment Analysis** để đánh giá kỹ năng xử lý tình huống

#### 📞 CSKH Agent (Ngoại bộ — Zalo OA)
- Giao tiếp với khách hàng qua **Zalo OA** thông qua n8n
- **Human-in-the-loop:** Khi phát hiện khiếu nại phức tạp:
  1. n8n bắn **Webhook** → NestJS Backend
  2. NestJS đẩy **WebSocket notification** → Web Portal
  3. HR Admin tiếp quản hội thoại

### 2.3 🔐 PII Anonymization Agent (Bảo mật)

- **Vị trí:** Middleware tại Backend NestJS
- **Quy trình:**
  1. Quét bằng Regex + NER → **Masking** PII trước khi gọi LLM bên ngoài
  2. LLM xử lý data đã ẩn danh
  3. **De-anonymize** kết quả trả về
- Tuân thủ tiêu chuẩn bảo mật cấp doanh nghiệp

### 2.4 ⚡ WebSocket Real-time

- NestJS dùng `@nestjs/websockets` + `socket.io`
- Real-time notification cho Admin khi có khiếu nại CSKH
- Rate limiting: 10 req/1s, 50 req/10s, 200 req/60s

---

## LLM Sử Dụng

| Agent | LLM | Ghi chú |
|-------|-----|----------|
| Router | Google Gemini | Intent classification |
| HR Q&A | Google Gemini | RAG + employee context |
| Training | Google Gemini | Role-play + scoring |
| CSKH Zalo | Google Gemini | Customer support |

**API Key:** Google AI Studio (free tier: 15 RPM, 1M tokens/day)

---

*Liên kết:* [[00 - Tổng Quan Dự Án]] | [[06 - n8n Workflows & AI Agents]]
