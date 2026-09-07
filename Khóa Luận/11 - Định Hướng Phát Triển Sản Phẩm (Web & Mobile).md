---
tags: [khoa-luan, product-orientation, web, mobile, killer-features, architecture]
created: 2026-09-07
status: approved
---

# 🚀 Định Hướng Phát Triển Sản Phẩm (Web & Mobile) & 4 Tính Năng Đột Phá

> **Tài liệu chiến lược:** Định hướng phân rã tính năng theo thiết bị (Form Factor), mô hình phân quyền RBAC và 4 tính năng "Killer Features" tạo điểm nhấn công nghệ cho Đồ án Khóa luận Tốt nghiệp.

---

## 🎯 1. Chiến Lược Phân Rã Tính Năng (Context-Aware Design)

Hệ thống đi theo chuẩn thiết kế doanh nghiệp hiện đại:
* **Web Portal (Desktop-first):** Giải quyết bài toán **Quản trị toàn diện & Bàn giấy** với không gian màn hình lớn. Dành cho cả **Sếp / HR Admin** và **Nhân viên (Employee Self-Service)** qua cơ chế phân quyền Role-Based Access Control (RBAC).
* **Mobile App (On-the-go):** Giải quyết bài toán **Tức thời & Di động**. Tập trung vào trải nghiệm mang tính vật lý cá nhân của **Nhân viên**: Chấm công định vị và Luyện tập kỹ năng qua Chat mô phỏng.

---

## 💻 2. Kiến Trúc Trang Web Portal (Next.js 16 + shadcn/ui)

### 2.1. Phân hệ Quản trị (Admin / HR Manager / Manager)
1. **📊 Dashboard Điều hành (`/admin/dashboard`):** Thống kê quân số đi làm, đơn phép chờ duyệt, quỹ lương tháng, biểu đồ biến động nhân sự (Recharts).
2. **👥 Quản lý Nhân sự & Hợp đồng (`/admin/employees`):** Bảng dữ liệu nhân viên (TanStack Table), quản lý hợp đồng lao động, mức lương cơ bản, ngày phép năm.
3. **⏰ Bảng công & Duyệt phép (`/admin/attendance-leave`):** Ma trận chấm công cả tháng (Timesheet), kiểm tra giờ OT, duyệt hoặc từ chối đơn xin nghỉ phép 1-click.
4. **💰 Tính & Duyệt Lương (`/admin/payroll`):** Giao diện kích hoạt Rule Engine tính lương tự động, bảng lương chi tiết (Gross, BHXH 8%, BHYT 1.5%, BHTN 1%, Thuế TNCN 7 bậc, Net), xuất Excel.
5. **🚨 Trung tâm Tiếp quản CSKH Zalo (`/admin/cskh-escalation`):** Nhận cảnh báo WebSocket thời gian thực khi khách khiếu nại gay gắt, xem toàn bộ lịch sử chat và nhắn tin can thiệp trực tiếp (Human-in-the-loop).
6. **📈 Báo cáo Năng lực Đào tạo AI (`/admin/training-analytics`):** Theo dõi bảng xếp hạng điểm kỹ năng của nhân viên qua 6 kịch bản giả lập, phân tích điểm yếu cần đào tạo.
7. **⚙️ Cài đặt Quy chế (`/admin/settings`):** Cấu hình các hằng số tính lương (SalaryConfig) và danh mục nhiệm vụ hội nhập (OnboardingTask).

### 2.2. Phân hệ Nhân viên (Employee Self-Service - ESS)
1. **🏠 Bàn làm việc cá nhân (`/portal/workspace`):** Widget giờ check-in hôm nay, số ngày phép còn lại, thông báo nội bộ.
2. **💵 Phiếu lương chi tiết (`/portal/my-payroll`):** Xem bảng chi tiết thu nhập, các khoản giảm trừ và tải file PDF phiếu lương.
3. **📝 Quản lý Nghỉ phép (`/portal/my-leaves`):** Form tạo đơn xin nghỉ phép, theo dõi tiến độ phê duyệt từ cấp trên.
4. **🚀 Lộ trình Hội nhập (`/portal/onboarding`):** Check-list danh sách việc cần làm cho nhân sự mới.
5. **💬 Widget Trợ lý HR AI (Floating Widget):** Chatbot góc màn hình hỏi đáp nhanh quy chế, chế độ thai sản, công tác phí.

---

## 📱 3. Kiến Trúc Màn Hình Mobile App (React Native + Expo)

Giao diện dạng **Bottom Tab Bar 4 tabs** tinh gọn, thao tác tiện lợi bằng ngón tay cái:

* **Tab 1 — 🏠 Trang Chủ & Chấm Công (Home & Attendance):**
  - Đồng hồ thời gian thực.
  - Trạng thái check-in hôm nay.
  - **Nút lớn [CHECK-IN / CHECK-OUT]** xác thực định vị nhanh.
* **Tab 2 — 🎮 Đánh Giá & Luyện Kỹ Năng (Hybrid Assessment: Trắc nghiệm + Tự luận AI):**
  - **Mô hình kết hợp 2 phần (thời gian làm bài 5 - 7 phút):**
    - **Phần 1: Trắc nghiệm Nội quy & Kiến thức (5 câu A/B/C/D):** Kiểm tra quy chế giờ giấc, phép năm, an toàn bảo mật... Backend NestJS tự động so khớp đáp án và chấm điểm ngay lập tức (không tốn token AI).
    - **Phần 2: Xử lý Tình huống Thực tế (2 câu Tự luận):**
      - *Tình huống 1:* Xử lý khiếu nại khách hàng khó tính / giao hàng trễ (Customer Service).
      - *Tình huống 2:* Giao tiếp nội bộ / giải quyết bất đồng tiến độ với đồng nghiệp (Internal Collaboration).
      - AI Agent (n8n WF03) đọc văn bản tự luận của nhân viên, phân tích ngữ nghĩa và chấm 4 tiêu chí mềm (*Chuyên nghiệp, Thấu cảm, Giải quyết vấn đề, Rõ ràng*).
  - **Báo cáo kết quả tổng hợp:** Điểm kiến thức (50%) + Điểm kỹ năng AI (50%), trực quan hóa bằng Biểu đồ Radar và nhận xét điểm mạnh/yếu từ AI.
* **Tab 3 — 💬 Trợ Lý HR AI (AI Q&A Assistant):**
  - Trò chuyện tra cứu ngày phép, chính sách, bảo hiểm cá nhân.
* **Tab 4 — 👤 Cá Nhân & Tiện Ích (Profile & Self-Service):**
  - Phiếu lương tóm tắt (Mobile Payslip), nộp đơn nghỉ phép nhanh, lịch sử chấm công cá nhân.

---

## 🌟 4. BỐN TÍNH NĂNG ĐỘT PHÁ ("KILLER FEATURES")

### 📍 1. Chấm Công Thông Minh Geofencing GPS (Mobile)
* **Cơ chế:** Mobile App tích hợp thư viện định vị (`expo-location`). Khi nhân viên bấm nút Chấm công, ứng dụng lấy toạ độ thực tế (Latitude, Longitude) và tính khoảng cách theo công thức Haversine tới tọa độ văn phòng công ty.
* **Quy tắc:** Chỉ cho phép Check-in nếu khoảng cách $\le 200\text{m}$. Nếu ở ngoài bán kính, hệ thống từ chối và cảnh báo *"Bạn đang ở ngoài khu vực văn phòng"*.
* **Tùy chọn nâng cao:** Bật camera trước chụp nhanh 1 tấm ảnh selfie xác thực khuôn mặt (Face Evidence).
* **Giá trị bảo vệ:** Thể hiện tính thực tiễn cao, giải quyết triệt để gian lận chấm công từ xa.

### 🚨 2. Âm Thanh & Popup Cảnh Báo Handoff Real-Time (Web Admin)
* **Cơ chế:** Khi Workflow 04 (CSKH Agent) phát hiện khách hàng Zalo có lời lẽ bức xúc, đe dọa pháp lý hoặc đòi gặp cấp trên $\rightarrow$ Tự động gán tag `[CAN_ESCALATE]` và gửi webhook về NestJS Backend `POST /api/v1/n8n/escalate`.
* **Phản ứng tức thì:**
  - Backend phát sự kiện qua **WebSocket (`@nestjs/websockets` + `socket.io`)** tới room `admin`.
  - Màn hình Web Admin lập tức phát tiếng chuông báo động 🔔 kèm popup đỏ rực rỡ ở góc màn hình.
  - Admin bấm vào popup $\rightarrow$ Mở thẳng giao diện xem trọn vẹn lịch sử chat và tiếp quản khách hàng.
* **Giá trị bảo vệ:** Minh chứng sống động cho mô hình **Human-in-the-loop (Con người can thiệp)** trong các hệ sinh thái AI doanh nghiệp.

### 📊 3. Biểu Đồ Radar Năng Lực Đào Tạo 4 Tiêu Chí (Web & Mobile)
* **Cơ chế:** Áp dụng mô hình Đánh giá Kết hợp (Hybrid Assessment) cho 2 câu tình huống tự luận:
  - *Tình huống 1:* Xử lý khiếu nại khách hàng khó tính / giao trễ.
  - *Tình huống 2:* Giao tiếp nội bộ / giải quyết bất đồng tiến độ dự án với đồng nghiệp.
  - n8n AI Agent (WF03) đọc văn bản tự luận của nhân viên và tự động chấm điểm theo **4 tiêu chí chuẩn quốc tế (thang điểm 0 - 10)**:
    1. `professional` (Tính chuyên nghiệp, đúng mực)
    2. `empathy` (Sự thấu cảm, lắng nghe đối phương)
    3. `problem_solving` (Năng lực đưa ra giải pháp thực tế)
    4. `clarity` (Độ rõ ràng, gãy gọn trong diễn đạt)
* **Trực quan hóa:**
  - **Trên Mobile App:** Kết thúc bài test, hiển thị ngay **Biểu đồ Radar (Spider Chart)** 4 cánh thể hiện điểm kỹ năng, kết hợp với điểm trắc nghiệm nội quy (chấm bởi NestJS) để ra điểm tổng kết.
  - **Trên Web Admin:** HR xem được ma trận kỹ năng của toàn bộ nhân viên, phát hiện phòng ban nào còn yếu về "Thấu cảm" hoặc "Giải quyết vấn đề" để lên kế hoạch đào tạo.
* **Giá trị bảo vệ:** Không lạm dụng AI cho câu hỏi trắc nghiệm kiến thức, chỉ dùng AI đúng sở trường đánh giá kỹ năng mềm tự luận, có số liệu định lượng khoa học.

### 🔒 4. Cơ Chế PII Masking Trực Quan & Audit Trail Tuân Thủ Bảo Mật
* **Cơ chế:** Tại Workflow 01 (Router Agent), mọi tin nhắn từ người dùng đều phải đi qua bộ lọc **Regex + Rule-based Masking** trước khi gửi lên các mô hình ngôn ngữ lớn (Google Gemini Cloud):
  - CCCD/CMND 9 hoặc 12 chữ số $\rightarrow$ `[MASKED_ID]`
  - Số điện thoại Việt Nam $\rightarrow$ `[MASKED_PHONE]`
  - Email cá nhân $\rightarrow$ `[MASKED_EMAIL]`
* **Trực quan hóa trên giao diện:** Trong nhật ký kiểm toán (Audit Trail) trên Web Portal, hiển thị đối chiếu giữa tin nhắn gốc được mã hóa trong nội bộ và chuỗi dữ liệu đã che khi làm việc với AI.
* **Giá trị bảo vệ:** Đáp ứng tiêu chuẩn bảo mật cấp doanh nghiệp (Enterprise Data Privacy), chứng minh hệ thống không làm rò rỉ dữ liệu cá nhân của nhân sự và khách hàng lên các dịch vụ AI bên thứ ba.

---

## 🔄 5. Cơ Chế Tự Động Reset Sau 12h Đêm & Quản Lý Phiên Chat (On-Demand Expiration)

### 5.1. Bài toán nghiệp vụ & Nguyên tắc phân lập (Session Isolation)
* **Vấn đề:** Khi khách hàng trên Zalo có khiếu nại gay gắt hoặc vượt thẩm quyền, AI Agent kích hoạt Escalation $\rightarrow$ Bot phải **tạm dừng (Mute)** để nhân viên con người tiếp quản.
* **Nguyên tắc phân lập:** Việc tắt Bot chỉ diễn ra **cục bộ cho DUY NHẤT khách hàng đó** (`externalId: zalo_userId`). Hàng trăm khách hàng khác nhắn tin đến vẫn được Bot AI phục vụ bình thường, không làm tê liệt toàn hệ thống.

### 5.2. Thuật toán kiểm tra động theo ngày (On-demand Expiration — Cách 2)
Thay vì dùng cron job chạy ngầm quét toàn bộ database lúc nửa đêm gây lãng phí tài nguyên, hệ thống áp dụng cơ chế **kiểm tra động ngay khi khách gửi tin nhắn**:

```
[Khách hàng gửi tin nhắn đến Zalo]
             │
             ▼
[POST /api/v1/n8n/chat/session] ──► Truy vấn Session gần nhất của khách
             │
             ▼
[So sánh múi giờ Asia/Ho_Chi_Minh: session.updatedAt vs nowVn]
             │
    ┌────────┴─────────────────────────┐
    ▼                                  ▼
[CÙNG NGÀY (Chưa qua 12h đêm)]      [KHÁC NGÀY (Đã qua 12h đêm)]
    │                                  │
    ├─ Nếu isActive: true              ├─ Đóng session cũ (isActive = false)
    │  ► Tiếp tục hội thoại AI         └─ TẠO SESSION MỚI TOANH
    └─ Nếu isActive: false (Escalated)    ► isActive = true
       ► Bot VẪN TẮT, nhường người        ► BOT TỰ ĐỘNG HỒI SINH!
```

### 5.3. Can thiệp thủ công từ Admin (Manual Reactivation)
* Bổ sung endpoint: `POST /api/v1/n8n/chat/session/:sessionId/reactivate`.
* Nếu nhân viên CSKH đã xử lý xong khiếu nại ngay trong ngày, nhân viên chỉ cần bấm nút **[Bật lại Bot]** trên Web Portal $\rightarrow$ Hệ thống chuyển ngay `isActive = true` mà không cần đợi sang ngày mới.

### 5.4. Kết quả kiểm thử tự động (Test Verification)
Hệ thống đã được kiểm thử toàn diện qua script tự động [`scripts/test-reset-behavior.mjs`](file:///c:/Users/Admin/Documents/admin/khoa-luan/scripts/test-reset-behavior.mjs) với kết quả đạt **5/5 bài test thành công 100%**:
1. ✅ Khách mới nhắn $\rightarrow$ Khởi tạo session với `isActive: true` (Bot hoạt động).
2. ✅ Escalate vượt thẩm quyền $\rightarrow$ Chuyển `isActive: false` (Bot bị tắt).
3. ✅ Khách nhắn tiếp trong cùng ngày $\rightarrow$ Giữ nguyên session cũ (`isActive: false`), Bot không xen ngang.
4. ✅ Admin chủ động kích hoạt lại $\rightarrow$ Cập nhật `isActive: true` thành công.
5. ✅ Khách nhắn lại vào ngày hôm sau (sau 12h đêm) $\rightarrow$ Tự động sinh session mới toanh với `isActive: true` (Bot tự động bật lại).

---

## 🔗 Liên Kết Tài Liệu Liên Quan
- [[00 - Tổng Quan Dự Án]]
- [[01 - Kiến Trúc Hệ Thống & Multi-Agent]]
- [[03 - Web Portal (Next.js)]]
- [[04 - Mobile App (React Native)]]
- [[06 - n8n Workflows & AI Agents]]
- [[10 - Nhật Ký Tích Hợp n8n & NestJS (E2E Test)]]
