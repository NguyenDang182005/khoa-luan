---
tags: [khoa-luan, frontend, nextjs, web, admin-portal, status-completed]
created: 2026-09-04
updated: 2026-09-09
status: completed
---

# 🏠 Web Portal Enterprise (Next.js 16 + shadcn/ui)

## 📌 Thông Tin Kỹ Thuật

| Mục | Giá trị |
|---|---|
| **Framework** | Next.js 16.3 (React 19, Turbopack) |
| **Port** | **3000** (`http://localhost:3000`) |
| **Path** | `apps/web/` |
| **Styling** | Tailwind CSS v4 (`@theme inline`, OKLCH Color Palette) |
| **UI Components** | shadcn/ui (style `base-nova` trên nền `@base-ui/react`) |
| **Charts** | Recharts (AreaChart, PieChart, RadarChart) |
| **Data Tables** | TanStack Table v8 |
| **State & Forms** | Zustand + React Hook Form + Zod |
| **Type Safety** | `@repo/shared-types` |
| **Trạng thái** | ✅ **Đã hoàn thiện & Kiểm thử đạt 100%** |

---

## 🏛️ Bố Cục Điều Hướng 4 Tầng (Multi-tier Enterprise Shell)

1. **Top Shell Header (`h-14`):**
   - Brand Logo: "HR Multi-Agent Platform Enterprise".
   - Ô tìm kiếm nhanh toàn cục `⌘ K` (Global Search Dialog).
   - Trạng thái kết nối Server: `API :3001` và `n8n :5678`.
   - Nút chuyển vai trò: **[HR Admin]** $\longleftrightarrow$ **[Nhân Viên (ESS)]**.
   - Chuông cảnh báo WebSocket thời gian thực khi có khiếu nại khẩn cấp.
2. **Left Icon Rail (`w-16`):**
   - Thanh công cụ thu gọn chuyển nhanh 7 phân hệ với các icon: `Dashboard`, `Employees`, `Payroll`, `AI Agents`, `Escalations`, `Training`, `Employee Portal`.
3. **Contextual Sub-Sidebar (`w-64`):**
   - Danh mục con động theo từng phân hệ.
4. **Main Workspace Canvas:**
   - Hiển thị bảng biểu, biểu đồ Recharts hoặc khung chat AI tương tác.
5. **Right Inspector Drawer (`w-72`):**
   - Bảng ngữ cảnh xem thông số kỹ thuật Agent, độ trễ, số nguồn dữ liệu và hồ sơ chi tiết.

---

## 🚀 7 Phân Hệ Nghiệp Vụ Hoàn Chỉnh

1. 📊 **Bảng Điều Hành Quản Trị (`dashboard-view.tsx`):**
   - 4 Thẻ KPI: Tổng quân số (248), Tỷ lệ đi làm (94.2%), Quỹ lương (3.25 Tỷ), AI Resolution (98.4%).
   - Recharts AreaChart 30 ngày & PieChart phân bổ phòng ban.
   - Bảng duyệt phép 1-click & Feed hoạt động n8n real-time.
2. 👥 **Quản Lý Nhân Sự & Hợp Đồng (`employees-view.tsx`):**
   - TanStack Data Table với tìm kiếm tức thời, lọc phòng ban, thanh tiến độ ngày phép còn lại.
   - Drawer trượt **5 nhóm thông tin**: (1) Hồ sơ cá nhân — sửa được phone/address/ngày sinh/CCCD qua `PATCH /employees/:id`; (2) Nghề vụ & HĐLĐ — phòng ban, chức danh, quản lý trực tiếp, hợp đồng active + lương thỏa thuận; (3) Công & phép — phép năm + tổng hợp chấm công tháng; (4) Lịch sử lương — các kỳ gần nhất từ `GET /payroll/employee/:id`; (5) Trạng thái & tài khoản — email đăng nhập + switcher trạng thái `PATCH /employees/:id/status`.
   - Ghi chú nạp AI Context cho Chatbot (WF01/WF02 tự đọc ngữ cảnh này).
3. 💰 **Bảng Lương & Rule Engine Tự Động (`payroll-view.tsx`):**
   - Tính toán lương Gross-to-Net tự động theo luật Việt Nam: BHXH 8%, BHYT 1.5%, BHTN 1%, Thuế TNCN 7 bậc.
   - Nút kích hoạt Rule Engine tự động tính lương toàn công ty.
   - **Duyệt hàng loạt**: checkbox chọn từng phiếu/chọn tất cả → `POST /payroll/approve-bulk` (DRAFT→APPROVED) hoặc `paid-bulk` (APPROVED→PAID) kèm dialog xác nhận; vẫn giữ duyệt từng phiếu.
   - Dialog cài đặt quy chế lương (`SalaryConfig`).
4. 🤖 **Trung Tâm Điều Khiển AI Multi-Agents (`ai-agents-view.tsx`):** *(tái cấu trúc 14/09 — theo vai trò từng agent)*
   - **WF01 (Router)** → dashboard giám sát, không chat: 3 ô số liệu thật từ DB (`/agents/performance`: độ chính xác, độ trễ gần nhất, số cuộc gọi), biểu đồ **Định Tuyến Intent** (HR_QA/CSKH/TRAINING/OTHER + escalation, `/agents/intent-stats`), nút **Ping AI (E2E)** gửi 1 lượt chat thật qua WF01→Gemini và đo `latencyMs` server-side.
   - **WF02 / WF03** → khung chat test agent (tin nhắn qua `POST /agents/chat` → WF01 Router → agent), lịch sử chat theo từng tab.
   - **WF04** → **bảng thông báo chỉ-đọc**: danh sách hội thoại CSKH từ Slack (customer ID, trạng thái escalate/bot, số tin) + card dữ liệu khách + tóm tắt hội thoại; không có ô input (trả lời khách làm ở trang Cảnh Báo CSKH).
   - Sidebar trái: 4 agent kèm độ trễ từng workflow + badge tổng tin đã định tuyến, tự làm mới 30s.
5. 🚨 **Tiếp Quản CSKH & PII Audit Trail (`cskh-escalation-view.tsx`)** — *Killer Features #2 & #4:*
   - Banner đỏ nhấp nháy cảnh báo WebSocket khi khách giận dữ (>9/10) — dữ liệu escalate thật từ WF04.
   - Split chat tiếp quản trực tiếp giữa người và bot; phản hồi được forward thẳng tới khách qua Slack DM (transport demo của kênh Zalo).
   - Tab "Tất cả hội thoại" xem mọi phiên CSKH (`GET /agents/conversations`), không chỉ phiên escalated.
   - Nút 1-click **[🤖 Bật Lại Bot AI]** (On-demand session reset).
   - Bảng đối chiếu PII Masking song song (`[MASKED_ID]`, `[MASKED_PHONE]`).
   - *(14/09)* Phân biệt rõ 3 trạng thái: đang tải / **lỗi quyền 403** (banner đỏ gợi ý dùng tài khoản Admin) / hết hội thoại — trước đây lỗi quyền bị nuốt và hiển thị nhầm thành "Chưa có hội thoại".
6. 📈 **Đào Tạo & Radar AI (`training-analytics-view.tsx`)** — *Killer Feature #3:*
   - Biểu đồ Radar (Spider Chart) 4 cánh: Chuyên nghiệp, Thấu cảm, Giải pháp, Rõ ràng.
   - Bảng xếp hạng mô hình Hybrid Assessment (5 trắc nghiệm NestJS + 2 tự luận Gemini AI).
7. 👤 **Cổng Nhân Viên Tự Phục Vụ - ESS (`employee-portal-view.tsx`):**
   - Chấm công định vị GPS (200m) với nút Check-out nhanh.
   - Widget phép năm còn lại, nộp đơn nghỉ phép qua Dialog.
   - Phiếu lương điện tử chi tiết có thể mở rộng (Accordion).
   - **Floating HR AI Assistant Widget** góc phải dưới màn hình sẵn sàng hỗ trợ 24/7.

---

## 🧪 Kết Quả Kiểm Thử & Nghiệm Thu
- TypeScript Check: `pnpm --filter web check-types` $\rightarrow$ **0 errors**.
- Next.js Build: `pnpm --filter web build` $\rightarrow$ **Compiled & Prerendered Static thành công 100%**.
- Trình duyệt DevTools: Kiểm tra trực tiếp tại `http://localhost:3000` với 8/8 tiêu chí đạt 100%.

---

*Tài liệu chi tiết:* [[12 - Báo Cáo Triển Khai & Kiểm Thử Web Portal (Next.js + shadcn ui)]] | [[11 - Định Hướng Phát Triển Sản Phẩm (Web & Mobile)]] | [[10 - Nhật Ký Tích Hợp n8n & NestJS (E2E Test)]]
