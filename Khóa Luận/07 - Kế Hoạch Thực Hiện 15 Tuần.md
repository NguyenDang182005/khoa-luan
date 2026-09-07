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
| **5–6** | 🤖 **Tác tử Điều phối & Bảo mật** — Tích hợp luồng AI, xây dựng Router Agent và Middleware Ẩn danh hóa dữ liệu (PII) | Tin nhắn nội bộ được định tuyến an toàn tới các Tác tử | 🔄 Đang thực hiện |
| **7–8** | 📊 **Triển khai GraphRAG & Tác tử HR** — Số hóa nội quy, thiết lập CSDL đồ thị, tích hợp AI hỏi đáp luật lao động | Trợ lý HR trả lời chuẩn xác kèm trích dẫn nguồn | ⏳ Chưa bắt đầu |
| **9–10** | 🎮 **Tác tử Đào tạo & Tích hợp CSKH** — Cấu hình AI Role-play, thiết lập luồng n8n cho Zalo OA và bắn Webhook/WebSocket về NestJS | Module bài test thực chiến hoạt động; Hệ thống cảnh báo khiếu nại CSKH chạy thời gian thực | ⏳ Chưa bắt đầu |
| **11–12** | 🏠 **Phát triển Frontend** — Dựng Web Portal cho Admin (Next.js) nhận cảnh báo WebSocket, và App Mobile cho nhân viên (React Native) | Admin và Nhân viên tương tác thành công với các chức năng phân quyền | ⏳ Chưa bắt đầu |
| **13–14** | 🔍 **Tích hợp, Kiểm thử & Tinh chỉnh** — Ráp nối toàn bộ hệ thống, test các ca kiểm thử biên và đánh giá độ trễ | Hệ thống đồng bộ xuyên suốt từ luồng nhập liệu đến trích xuất kết quả | ⏳ Chưa bắt đầu |
| **15** | 🏁 **Hoàn thiện** — Đóng gói mã nguồn, viết báo cáo đồ án và thiết lập môi trường Demo | Sẵn sàng dữ liệu và sản phẩm cho buổi bảo vệ | ⏳ Chưa bắt đầu |

## Tiến Độ Hiện Tại (Tuần ~5-6)

- [x] Thiết kế kiến trúc & Schema
- [x] Backend NestJS core (Auth, Employees, Departments, Attendance, Payroll, Leave, Contracts)
- [x] Modules mới: SalaryConfig, Onboarding, AiContext, Notifications
- [x] n8n workflows (4 workflow JSON)
- [ ] GraphRAG / Knowledge Graph cho HR
- [ ] Frontend Web Portal (Next.js)
- [ ] Mobile App (React Native) hoàn chỉnh
- [ ] Integration testing
- [ ] Demo environment

---

*Liên kết:* [[00 - Tổng Quan Dự Án]]
