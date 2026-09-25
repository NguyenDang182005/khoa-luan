---
tags: [khoa-luan, timeline, ke-hoach, 15-tuan]
created: 2026-09-04
---

# 📅 Kế Hoạch Thực Hiện 15 Tuần

## Tổng Quan

Dự án khóa luận được chia thành **5 giai đoạn** trong **15 tuần**.

## Timeline

| Tuần | Giai đoạn & Công việc | Kết quả dự kiến | Trạng thái |
|------|----------------------|---------------------|------------|
| **1–2** | 📌 **Khảo sát & Thiết kế** — Phân tích quy trình HR, thiết kế kiến trúc hệ thống và luồng dữ liệu (Monorepo, Database Schema) | Bản vẽ kiến trúc hệ thống và Schema hoàn chỉnh | ✅ Hoàn thành |
| **3–4** | ⚙️ **Backend Core & Động cơ Lương** — Thiết lập Monorepo, xây dựng API cốt lõi NestJS, lập trình thuật toán Rule-based | NestJS API sẵn sàng; Module chấm công và tính lương hoạt động | ✅ Hoàn thành |
| **5–6** | 🤖 **Tác tử Điều phối & Bảo mật** — Tích hợp luồng AI, xây dựng Router Agent và Middleware Ẩn danh hóa dữ liệu (PII) | Tin nhắn nội bộ được định tuyến an toàn tới các Tác tử | ✅ Hoàn thành |
| **7–8** | 📊 **Triển khai GraphRAG & Tác tử HR** — Số hóa nội quy, thiết lập CSDL đồ thị, tích hợp AI hỏi đáp luật lao động | Trợ lý HR trả lời chuẩn xác kèm trích dẫn nguồn | 🔄 **RAG + pgvector đã chạy 14/09** (`policy_chunks` + tool SearchPolicyKnowledge WF02, E2E trích dẫn đúng tài liệu) — GraphRAG đa nhịp là mở rộng tiếp theo |
| **9–10** | 🎮 **Tác tử Đào tạo & Tích hợp CSKH** — Cấu hình AI Role-play, thiết lập luồng n8n cho kênh khách hàng (Zalo OA — demo qua Slack DM) và bắn Webhook/WebSocket về NestJS | Module bài test thực chiến hoạt động; Hệ thống cảnh báo khiếu nại CSKH chạy thời gian thực | ✅ Hoàn thành |
| **11–12** | 🏠 **Phát triển Frontend** — Dựng Web Portal cho Admin (Next.js) nhận cảnh báo WebSocket, và App Mobile cho nhân viên (React Native) | Admin và Nhân viên tương tác thành công với các chức năng phân quyền | ✅ Web Portal hoàn thành — Mobile **cắt khỏi scope 25/09**, chuyển hướng phát triển ([[23 - Quyết Định Web-Only Phase 1 (Cắt Mobile App)]]) |
| **13–14** | 🔍 **Tích hợp, Kiểm thử & Tinh chỉnh** — Ráp nối toàn bộ hệ thống, test các ca kiểm thử biên và đánh giá độ trễ | Hệ thống đồng bộ xuyên suốt từ luồng nhập liệu đến trích xuất kết quả | 🔄 E2E từng luồng AI đã pass — tiếp tục tinh chỉnh |
| **15** | 🏁 **Hoàn thiện** — Đóng gói mã nguồn, viết báo cáo đồ án và thiết lập môi trường Demo | Sẵn sàng dữ liệu và sản phẩm cho buổi bảo vệ | ⏳ Chưa bắt đầu |

## Cập Nhật 14/09 — Mở Rộng Tính Năng & Dữ Liệu Demo

- [x] **Duyệt lương hàng loạt**: `POST /payroll/approve-bulk` + `POST /payroll/paid-bulk` (multi-select trên Bảng Lương, giữ nguyên duyệt từng phiếu)
- [x] **Hồ sơ nhân viên 5 nhóm**: cá nhân (sửa được PATCH `/employees/:id`), nghề vụ & HĐLĐ (kèm quản lý trực tiếp), công & phép (tổng hợp chấm công tháng), lịch sử lương `GET /payroll/employee/:id`, trạng thái & tài khoản (đổi status `PATCH /employees/:id/status`)
- [x] **Router Agent hiển thị card + thống kê intent**: `GET /agents/intent-stats` đếm `metadata.intent` → panel tỷ lệ HR_QA/CSKH/TRAINING/OTHER + số escalation trên AI Sandbox
- [x] **CSKH kênh Zalo — demo Slack**: WF04 nhận Slack Events API, gửi trả lời qua NestJS `POST /n8n/outbound-reply` (Slack DM, token server-side); portal có tab "Tất cả hội thoại" (`GET /agents/conversations`) + forward phản hồi tiếp quản thẳng tới khách
- [x] **Trang Cài Đặt (HR_ADMIN/ADMIN)**: Cấu hình lương & thuế theo năm, Geofence chấm công lưu DB (`OfficeGeofence`, thay env `NEXT_PUBLIC_OFFICE_*`), ping trạng thái tích hợp DB/n8n/Slack/Gemini
- [x] **Seed demo đầy đủ**: 30 nhân viên (5 phòng ban, 10 chức danh), 2.183 bản ghi chấm công, payroll 4 kỳ (m6–7 PAID, m8 APPROVED, m9 DRAFT), hội thoại AI kèm 2 phiên escalated
- [x] **Hardening**: PII WF04 (lưu original + masked), secrets về root `.env` (gitignored), Zod cho attendance/escalation/onboarding clients
- [x] **Chạy thật Slack CSKH E2E**: challenge echo + message.im → WF04 → Gemini → DB; fix 3 lỗi gốc n8n (IF boolean operator, `$env` bị chặn → credential Header Auth, stale graph khi PATCH workflow active)
- [x] **RAG chính sách nhân sự**: bảng `policy_chunks` (10 tài liệu, embedding Gemini 768 dims) + `KnowledgeModule` (`/n8n/knowledge-search`, dual-mode pgvector/cosine) + tool `SearchPolicyKnowledge` trên WF02 — E2E trả lời trích dẫn đúng tài liệu

## Tiến Độ Hiện Tại (Tuần ~6-7)

- [x] Thiết kế kiến trúc & Schema
- [x] Backend NestJS core (Auth, Employees, Departments, Attendance, Payroll, Leave, Contracts)
- [x] Modules mới: SalaryConfig, Onboarding, AiContext, Notifications, Settings (geofence + integration status)
- [x] n8n workflows (4 workflow + 1 Slack URL verification)
- [x] Frontend Web Portal (Next.js) — 10 views chạy real API + Zod
- [x] Duyệt lương hàng loạt + hồ sơ 5 nhóm + thống kê intent + CSKH Slack
- [x] RAG + pgvector (dual-mode) cho HR Q&A — GraphRAG đa nhịp là mở rộng tiếp theo
- [x] Chốt scope Web-only: cắt Mobile App khỏi Phase 1 (25/09 — [[23 - Quyết Định Web-Only Phase 1 (Cắt Mobile App)]])
- [ ] Full regression testing
- [ ] Demo environment

---

*Liên kết:* [[00 - Tổng Quan Dự Án]]
