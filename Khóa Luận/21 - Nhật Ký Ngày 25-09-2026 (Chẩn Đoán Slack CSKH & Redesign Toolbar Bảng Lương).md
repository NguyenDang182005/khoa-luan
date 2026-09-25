---
tags: [khoa-luan, nhat-ky, cskh, escalation, slack-transport, payroll, ui-redesign, toolbar, responsive, enterprise-layout]
created: 2026-09-25
updated: 2026-09-25
---

# 📅 Nhật Ký Ngày 25-09-2026 — Chẩn Đoán CSKH Escalation & Redesign Toolbar Bảng Lương

> **Chủ đề chính:** 
> 1. Chẩn đoán bản chất cảnh báo `NOT_A_SLACK_USER` tại phân hệ Bàn Tiếp Quản CSKH khi chuyên viên gửi tin nhắn tiếp quản.
> 2. Tái cấu trúc và thiết kế lại toàn bộ CSS thanh công cụ (Toolbar & Header) trên trang Bảng Lương (`payroll-view.tsx`) theo chuẩn 2-Tier Enterprise Layout, xóa bỏ hoàn toàn hiện tượng nút bấm bị rớt dòng.

---

## 1. Chẩn Đoán Cảnh Báo CSKH Escalation (`NOT_A_SLACK_USER`) 🚨

### 1.1. Hiện Tượng & Triệu Chứng
- Trên giao diện **Bàn Tiếp Quản CSKH** (`/cskh-escalation`), người dùng chọn phiên khiếu nại của khách hàng `test_cskh_escalate_user`, nhập nội dung phản hồi *"hello"* và bấm **Gửi**.
- Tin nhắn *"hello"* xuất hiện thành công trong bong bóng chat của chuyên viên, nhưng phía trên ô nhập liệu xuất hiện thông báo màu vàng:
  ```text
  ⚠️ Đã lưu vào phiên nhưng CHƯA gửi tới Slack (NOT_A_SLACK_USER). Kiểm tra SLACK_BOT_TOKEN / externalId.
  ```

### 1.2. Phân Tích Kỹ Thuật & Cơ Chế Luồng
1. **Lưu phiên thành công:**
   - Khi chuyên viên bấm Gửi, Web Portal gọi API `POST /agents/chat-session/:id/reply`.
   - Backend NestJS (`agents.service.ts`) lưu bản ghi `AiChatMessage` vào PostgreSQL với `role: 'assistant'`, `metadata: { sender: 'human', note: 'human_takeover' }` $\rightarrow$ **Thành công 100%**.
2. **Cơ chế chuyển tiếp (Forwarding Transport):**
   - Đồ án sử dụng **Slack** làm *transport demo* trung gian cho kênh Zalo OA khách hàng.
   - Sau khi lưu tin nhắn, NestJS tìm cách forward nội dung ra ngoài:
     - Nếu tin nhắn có metadata `slackChannel` + `threadTs` $\rightarrow$ gửi phản hồi vào Slack thread.
     - Nếu không có kênh cụ thể $\rightarrow$ fallback gọi `sendSlackDm(session.externalId, content)`.
3. **Nguyên nhân văng mã `NOT_A_SLACK_USER`:**
   - Hàm `sendSlackDm` trong `ai-context.service.ts` kiểm tra an toàn:
     ```typescript
     if (!externalId || !/^U[A-Z0-9]+$/i.test(externalId)) {
       return { delivered: false, reason: 'NOT_A_SLACK_USER' };
     }
     ```
   - Phiên chat này có `externalId = "test_cskh_escalate_user"` — đây là **dữ liệu mẫu / phiên giả lập** sinh ra từ script test E2E kịch bản vượt thẩm quyền ngày 21/09.
   - Do mã này không phải là ID người dùng Slack thật (Slack User ID có dạng `U...`, ví dụ `U0B6GMBMSU`), backend chủ động chặn lại và trả về `reason: 'NOT_A_SLACK_USER'` để không gọi API sai lên máy chủ Slack.
   - Frontend hiển thị cảnh báo để chuyên viên nắm được tin nhắn đã lưu nội bộ nhưng chưa forward được cho khách.

### 1.3. Kết Luận
- Đây là cơ chế bảo vệ hợp lý của hệ thống (Fail-safe), không phải lỗi crash hay lỗi mất mát dữ liệu.
- Khi tiếp quản các phiên bắt nguồn từ người dùng Slack thật (như phiên `Khách U0B6GMBMSU` hiển thị trong danh sách), tin nhắn được forward thành công ra Slack DM/Thread với thông báo màu xanh `✅ Đã lưu phiên và forward tới Slack DM khách hàng`.

---

## 2. Redesign Toàn Diện Thanh Công Cụ Trang Bảng Lương (`payroll-view.tsx`) 🎨

### 2.1. Vấn Đề Giao Diện Trước Khi Sửa
- **Lỗi tràn rớt dòng (Awkward Wrapping):** Header trang chứa tiêu đề dài, mô tả và dồn toàn bộ 2 dropdown (Tháng, Năm) cùng 3 nút bấm (`Cài Đặt Quy Chế`, `Xuất Excel`, `Chạy Rule Engine Tính Lương`) vào chung một container `flex flex-wrap`. Trên màn hình laptop/desktop tiêu chuẩn, nút *"Chạy Rule Engine Tính Lương"* bị đẩy xuống dòng 2 nằm lệch lạc dưới dropdown Tháng 9.
- **Thẻ `<select>` thô sơ:** Dùng kiểu mặc định của trình duyệt, không có icon chỉ báo dropdown, thiếu cảm giác phần mềm doanh nghiệp.
- **Thanh thao tác hàng loạt rời rạc:** Nằm lơ lửng bên dưới mà không kết nối logic với bộ chọn kỳ lương.

### 2.2. Giải Pháp: Cấu Trúc 2 Tầng Hiện Đại (2-Tier Enterprise Toolbar)

#### 🔹 Tầng 1: Hàng Tiêu Đề Chính (Page Header)
- **Bên trái:** Tiêu đề `Bảng Lương & Rule Engine Tính Lương Tự Động` và phụ đề nghiệp vụ thoáng đãng.
- **Bên phải:** Gom cụm 3 nút hành động chính của trang, căn lề phải ngay ngắn:
  1. `[⚙ Cài Đặt Quy Chế]` (Button `outline`, icon `Settings`)
  2. `[📥 Xuất Excel (CSV)]` (Button `outline`, icon `Download`)
  3. `[⚡ Chạy Rule Engine Tính Lương]` (Button `primary`, icon `Calculator`, hiệu ứng loading khi đang tính)
- Chiều rộng của 3 nút chỉ ~420px, hoàn toàn vừa vặn trên cùng một hàng với tiêu đề ở mọi độ phân giải máy tính, không bao giờ bị rớt dòng lẻ loi.

#### 🔹 Tầng 2: Thanh Công Cụ Toolbar Chuyên Biệt (Control Capsule)
Thiết kế thành một khối Card bo góc đồng bộ (`rounded-xl border border-border/70 bg-card/60 p-3 shadow-2xs backdrop-blur-xs`):
- **Cụm Trái — Bộ Chọn Kỳ Lương Thẩm Mỹ:**
  - Nhãn hiển thị kèm icon `Calendar`: *"Kỳ lương:"*.
  - Hai dropdown **Tháng** và **Năm** được bo góc tỉ mỉ, có mũi tên `ChevronDown` tùy biến.
  - Badge trạng thái kỳ: `🟢 Kỳ MM/YYYY • N bản ghi` giúp người dùng nhận diện ngay số lượng nhân viên trong kỳ tính lương.
- **Cụm Phải — Thao Tác Hàng Loạt Thông Minh (Bulk Actions):**
  - Hiển thị số lượng dòng được chọn: `Đã chọn X/Y dòng • Z đã chi trả (khóa)`.
  - Cụm nút tự động biến đổi trạng thái:
    - *Khi chưa chọn checkbox:* Hiển thị `Duyệt Tất Cả ({draftCount} chờ duyệt)` (viền emerald) và `Chi Trả Tất Cả ({approvedCount} đã duyệt)` (viền teal).
    - *Khi có tích chọn checkbox:* Tự động chuyển thành `Duyệt mục đã chọn`, `Chi trả mục đã chọn` và nút `Bỏ chọn`.

### 2.3. Kết Quả Kiểm Thử & Triển Khai
- Chạy kiểm tra tĩnh TypeScript:
  ```bash
  pnpm --filter web check-types
  # Output: Types generated successfully. Exit 0.
  ```
- Dev server Next.js (port 3000) tự động Hot Reload và cập nhật giao diện ngay lập tức.

---

## 3. Liên Kết & Tài Liệu Tham Chiếu 📌
- [[03 - Web Portal (Next.js)]] — Cập nhật mục Bảng Lương (payroll-view.tsx)
- [[09 - Task Checklist.md]] — Đánh dấu hoàn thành tinh chỉnh UI Bảng Lương
- [[18 - Nhật Ký Ngày 21-09-2026]] — Tham chiếu phiên test E2E WF04 CSKH Escalation
- [[20 - Nhật Ký Ngày 23-09-2026 (UI Audit & Fix Phiên Chat WF02)]] — Tham chiếu đợt audit UI trước
