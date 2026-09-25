---
tags: [khoa-luan, web-portal, nextjs, shadcn-ui, test-report, killer-features]
created: 2026-09-09
status: verified
---

# 🌐 Báo Cáo Triển Khai & Kiểm Thử Web Portal (Next.js 16 + shadcn/ui)

> **Nhật ký nghiệm thu:** Toàn bộ quá trình chuyển hóa template Enterprise thành Web Portal Quản trị Nhân sự Tích hợp AI Multi-Agent, kết quả kiểm thử thực tế trên trình duyệt đạt 100% mục tiêu thiết kế.

---

## 🏛️ 1. Kiến Trúc Giao Diện Doanh Nghiệp (Enterprise Architecture)

Hệ thống được phát triển theo cấu trúc Monorepo (`apps/web`), áp dụng các tiêu chuẩn công nghệ tiên tiến nhất:
* **Framework:** Next.js 16.3 (React 19) với App Router & Turbopack.
* **Styling & Design Tokens:** Tailwind CSS v4 với cấu hình `@theme inline` và không gian màu **OKLCH** siêu sắc nét.
* **Component System:** shadcn/ui thế hệ mới (phong cách `base-nova` trên nền `@base-ui/react`).
* **Trực quan hóa Dữ liệu:** Recharts (AreaChart, PieChart, Radar Chart).
* **Bố cục 4 tầng (Multi-tier Enterprise Shell):**
  1. *Top Shell Header (`h-14`):* Logo thương hiệu, ô tìm kiếm nhanh toàn cục `⌘ K`, trạng thái kết nối `API :3001` & `n8n :5678`, nút chuyển vai trò linh hoạt giữa **[HR Admin]** và **[Nhân Viên (ESS)]**, chuông cảnh báo WebSocket khẩn cấp.
  2. *Left Icon Rail (`w-16`):* Thanh công cụ thu gọn chuyển đổi tức thì giữa 7 phân hệ.
  3. *Contextual Sub-Sidebar (`w-64`):* Bảng chọn danh mục agent và ngữ cảnh phiên.
  4. *Main Workspace Canvas:* Khu vực hiển thị bảng biểu, biểu đồ hoặc phòng chat tương tác.
  5. *Right Inspector Drawer (`w-72`):* Bảng kiểm tra chi tiết trạng thái Agent, độ trễ, số sources hoặc hồ sơ nhân viên.

---

## 🎨 2. Hệ Thống Nhận Diện Màu Sắc 4 AI Agents (OKLCH Tokens)

| Agent | Mã Workflow n8n | Màu đại diện | CSS Token | Ý nghĩa nhận diện |
|---|---|---|---|---|
| **Router & Privacy** | WF01 | 🟢 Ngọc Bích | `--agent-teal` | Điều phối luồng & Khử định danh PII |
| **HR Policy Q&A** | WF02 | 🔵 Xanh Dương | `--agent-blue` | Hỏi đáp chính sách, bảo hiểm, phép năm |
| **Training & Onboarding** | WF03 | 🟠 Hổ Phách | `--agent-amber` | Đào tạo, trắc nghiệm & chấm tự luận |
| **Zalo CSKH & Escalation** | WF04 | 🔴 Đỏ San Hô | `--agent-coral` | Chăm sóc khách hàng & Cảnh báo khẩn cấp |

---

## 📋 3. Chi Tiết 7 Phân Hệ Nghiệp Vụ Đã Hiện Thực Hóa

### 1. Bảng Điều Hành Quản Trị (`/components/views/dashboard-view.tsx`)
- **4 Thẻ Chỉ Số KPI:** Tổng quân số (248), Tỷ lệ đi làm hôm nay (94.2%), Quỹ lương tháng 9 (₫3.25 Tỷ), Hiệu suất xử lý AI (98.4%).
- **Biểu đồ Recharts:** AreaChart chấm công 9 ngày đầu tháng + PieChart cơ cấu 4 khối phòng ban.
- **Tác vụ nhanh:** Duyệt đơn nghỉ phép chờ xử lý 1-click & Feed hoạt động n8n real-time.

### 2. Quản Lý Nhân Sự & Hợp Đồng (`/components/views/employees-view.tsx`)
- Lưới dữ liệu (TanStack Table) với tìm kiếm tức thời theo tên, mã NV, email.
- Bộ lọc phòng ban (Kỹ thuật, Nhân sự, CSKH, UI/UX).
- Thanh tiến độ ngày phép còn lại (9/12 ngày).
- **Slide-over Drawer 5 nhóm:** (1) Hồ sơ cá nhân — sửa được phone/địa chỉ/ngày sinh/CCCD (`PATCH /employees/:id`); (2) Nghề vụ & HĐLĐ — quản lý trực tiếp, hợp đồng active + lương; (3) Công & phép — phép năm + tổng hợp chấm công tháng; (4) Lịch sử lương (`GET /payroll/employee/:id`); (5) Trạng thái & tài khoản — switcher trạng thái (`PATCH /employees/:id/status`, validate enum 400 nếu sai) + ghi chú nạp AI Context tự động cho chatbot.

### 3. Bảng Lương & Rule Engine Tự Động (`/components/views/payroll-view.tsx`)
- Bảng lương Gross-to-Net chuẩn Luật Lao động Việt Nam:
  - Khấu trừ Bảo hiểm bắt buộc 10.5% (BHXH 8%, BHYT 1.5%, BHTN 1%).
  - Giảm trừ gia cảnh (Bản thân 11tr, Phụ thuộc 4.4tr/người).
  - Thuế TNCN lũy tiến 7 bậc.
- Nút bấm chạy **Rule Engine** tự động tính toán lại toàn bộ doanh nghiệp trong 1.2 giây.
- **Duyệt hàng loạt:** checkbox chọn từng phiếu / chọn tất cả → `POST /payroll/approve-bulk` (DRAFT→APPROVED) hoặc `paid-bulk` (APPROVED→PAID), dialog xác nhận; duyệt từng phiếu vẫn giữ nguyên.
- Dialog cài đặt quy chế lương (`SalaryConfig`).

### 4. Trung Tâm Điều Khiển AI Multi-Agents (`/components/views/ai-agents-view.tsx`)
- Tương tác chat 2 chiều trực tiếp với 4 workflows n8n (qua backend proxy JWT).
- Độ trễ đo thật từ `/agents/performance` (metadata `latency_ms` lưu khi n8n gọi NestJS), model `gemini-2.5-flash`.
- Right Inspector hiển thị thông số kỹ thuật, success rate tính từ DB, số nguồn trích xuất dữ liệu NestJS, quy tắc reset phiên sau 00:00 VN, và **thống kê định tuyến intent** (tỷ lệ HR_QA/CSKH/TRAINING/OTHER + số escalation) từ `GET /agents/intent-stats`.

### 5. Tiếp Quản CSKH & PII Audit Trail (`/components/views/cskh-escalation-view.tsx`) — *Killer Features #2 & #4*
- **Cảnh báo khẩn cấp:** Banner đỏ rực rỡ với hiệu ứng nhấp nháy nhận WebSocket khi phiên CSKH bị escalate thật từ WF04 (kênh Zalo — transport demo Slack DM).
- **Tất cả hội thoại:** Tab chuyển giữa "Chờ xử lý" (escalated) và toàn bộ phiên CSKH (`GET /agents/conversations`).
- **Split Chat Tiếp Quản:** Nhân viên HR/Admin nhắn tin can thiệp trực tiếp thay thế Bot — phản hồi lưu phiên và forward thẳng tới Slack DM khách (`POST /agents/chat-session/:id/reply`).
- **Nút 1-click [🤖 Bật Lại Bot AI]:** Gọi API On-demand reactivation (`POST /api/v1/n8n/chat/session/:sessionId/reactivate`) giúp bật lại Bot ngay trong ngày mà không cần đợi sang nửa đêm.
- **Kiểm toán PII Masking:** Bảng đối chiếu song song giữa tin nhắn nội bộ chứa CCCD/SĐT và chuỗi dữ liệu đã che `[MASKED_ID]`, `[MASKED_PHONE]` gửi lên Gemini Cloud.

### 6. Báo Cáo Năng Lực Đào Tạo AI & Biểu Đồ Radar (`/components/views/training-analytics-view.tsx`) — *Killer Feature #3*
- **Biểu đồ Radar (Spider Chart) 4 cánh:** Chuyên nghiệp, Thấu cảm, Giải quyết vấn đề, Diễn đạt rõ ràng.
- So sánh năng lực thực tế đợt đào tạo Onboarding với Chuẩn Benchmark công ty.
- Bảng xếp hạng kết quả mô hình Hybrid Assessment: Điểm Trắc nghiệm Nội quy (50%) + Điểm Tự luận Xử lý tình huống AI (50%) kèm nhận xét định lượng từ Gemini AI.

### 7. Cổng Nhân Viên Tự Phục Vụ - ESS (`/components/views/employee-portal-view.tsx`)
- Thẻ chấm công định vị GPS (trong bán kính 200m) với nút Check-out nhanh.
- Widget phép năm còn lại (9.5/12 ngày) kèm nút nộp đơn nghỉ phép qua Dialog.
- Phiếu lương điện tử chi tiết có thể mở rộng (Accordion breakdown).
- Lộ trình hội nhập (Onboarding Journey 3 mốc hoàn thành).
- **Floating HR AI Assistant Widget:** Nút tròn gradient nổi ở góc phải dưới màn hình, click mở cửa sổ chat hỏi đáp nhanh quy chế 24/7.

---

## 🧪 4. Kết Quả Kiểm Thử Thực Tế Trên Trình Duyệt (Verification Matrix)

Hệ thống đã được kiểm thử trực tiếp trên trình duyệt Chromium thông qua Chrome DevTools MCP tại địa chỉ `http://localhost:3000`:

| Hạng mục kiểm thử | Thao tác kiểm thử | Kết quả thực tế | Đánh giá |
|---|---|---|:---:|
| **Khởi động Web Dev** | `pnpm dev:web` | Khởi động trong **594ms**, trả về mã HTTP 200 | ✅ Pass |
| **Biên dịch TypeScript** | `pnpm --filter web check-types` | `next typegen && tsc --noEmit` hoàn thành với **0 lỗi** | ✅ Pass |
| **Build Production** | `pnpm --filter web build` | Turbopack biên dịch thành công 4/4 static pages | ✅ Pass |
| **Hiển thị Dashboard** | Điều hướng Tab 1 | Recharts AreaChart & PieChart hiển thị sắc nét | ✅ Pass |
| **Drawer Hồ Sơ 5 Nhóm** | Click "Xem Hồ Sơ" | Drawer hiển thị đủ: cá nhân (sửa được), nghề vụ & HĐLĐ, công & phép, lịch sử lương, trạng thái & tài khoản | ✅ Pass |
| **Sửa Hồ Sơ / Đổi Trạng Thái** | Drawer → "Sửa hồ sơ" / switcher | `PATCH /employees/:id` lưu mới; status sai enum bị backend chặn 400 | ✅ Pass |
| **Duyệt Lương Hàng Loạt** | Chọn nhiều phiếu DRAFT → Duyệt | `approve-bulk` chuyển DRAFT→APPROVED một lượt, bảng tự refresh | ✅ Pass |
| **Dialog Quy Chế** | Click "Cài Đặt Quy Chế" | Modal hiện lên với hiệu ứng làm mờ nền (Backdrop blur) | ✅ Pass |
| **Chat AI Agents** | Chuyển đổi 4 workflows | Chat stream hiển thị các badge và thẻ Inspector cập nhật tương ứng | ✅ Pass |
| **Tiếp Quản CSKH** | Tab Escalation | Banner đỏ nhấp nháy, chat tiếp quản và tab PII Masking hoạt động chuẩn | ✅ Pass |
| **Biểu Đồ Radar** | Tab Training | Spider Chart 4 cánh thể hiện rõ hai vùng diện tích so sánh | ✅ Pass |
| **Đổi Vai Trò ESS** | Click button "Nhân Viên (ESS)" | Chuyển ngay sang cổng cá nhân, Floating Chatbot mở/đóng mượt mà | ✅ Pass |

---

## 🚀 5. Hướng Dẫn Khởi Chạy Nhanh

Từ thư mục gốc dự án:
```powershell
# Chạy Web Portal (Next.js - Port 3000)
pnpm dev:web

# Chạy Backend NestJS (API - Port 3001)
pnpm dev:api
```
Truy cập giao diện: **`http://localhost:3000`**

---

*Liên kết:* [[00 - Tổng Quan Dự Án]] | [[01 - Kiến Trúc Hệ Thống & Multi-Agent]] | [[03 - Web Portal (Next.js)]] | [[11 - Định Hướng Phát Triển Sản Phẩm (Web & Mobile)]]
