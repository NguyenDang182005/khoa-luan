---
tags: [khoa-luan, nhat-ky, ui-audit, font, vietnamese, bug-fix, chat-session, wf02, leave-approval, inter, jetbrains-mono, q7-session]
created: 2026-09-23
updated: 2026-09-23
---

# 📅 Nhật Ký Ngày 23-09-2026 (Buổi chiều) — Kiểm Thử UI Toàn Diện & Sửa Lỗi Phiên Chat WF02

> **Chủ đề chính:** Kiểm thử giao diện toàn diện (font chữ thiếu dấu tiếng Việt, tham chiếu model cũ "Gemini 2.5", nút "Xem & Duyệt" không hoạt động, badge trạng thái xuống dòng) và sửa lỗi triệt để phiên chat WF02 luôn kéo lại đoạn chat cũ do quy tắc hết hạn phiên theo ngày (Q7) bị bypass.

---

## 1. Kiểm Thử UI Toàn Diện — 4 Lỗi Phát Hiện & Khắc Phục 🔍

### 1.1. Lỗi Nút "Xem & Duyệt" Không Hoạt Động (Duyệt Phép) 🐛
- **Triệu chứng:** Bấm nút **"Xem & Duyệt"** trong tab Duyệt Phép (`leave-approvals-tab.tsx`) không có bất kỳ phản hồi nào; trong khi cùng nút này ở Dashboard vẫn hoạt động.
- **Nguyên nhân:** Component chỉ `setDetailTarget(leave)` khi bấm nút, nhưng **thiếu hoàn toàn việc render `<LeaveDetailModal>`** trong JSX (component đã được import sẵn ở dòng 41 nhưng không dùng). `dashboard-view.tsx` thì render đúng nên không bị lỗi.
- **Khắc phục:**
  - Render `<LeaveDetailModal>` cuối component, map dữ liệu `detailTarget` (`LeaveRequest`) sang `LeaveDetailItem` theo đúng pattern của Dashboard (phòng trường hợp `employee` optional trong Zod schema).
  - Bổ sung handler `handleModalReject(id, reason)` cho nút Từ Chối bên trong modal (gọi `leaveApi.reject` + refresh danh sách + hiển thị success banner).

### 1.2. Badge "Chờ duyệt" Bị Xuống 2 Dòng Ở Cột Trạng Thái 🐛
- **Nguyên nhân:** Badge (`inline-flex`) thiếu `whitespace-nowrap`; khi bảng bị chật (do cột "Lý Do" `max-w-xs`), cụm dài nhất "Chờ duyệt" bị break-line giữa 2 từ, trong khi "Đã duyệt"/"Từ chối" ngắn hơn nên không lộ.
- **Khắc phục:** Thêm `whitespace-nowrap` cho cả 4 badge trạng thái (PENDING/APPROVED/REJECTED/CANCELLED) và cho `TableCell` của cột Trạng Thái.

### 1.3. Font Chữ Không Đồng Nhất (Triệu Chứng "Ping Lệch Font") — Đổi Toàn Bộ Sang Inter + JetBrains Mono 🔤
- **Nguyên nhân gốc rễ:** App dùng font **Geist qua `next/font/google` với subset `latin` duy nhất — không chứa ký tự tiếng Việt có dấu**. Hậu quả:
  - Chữ không dấu (VD: "Ping", "ms", số liệu `font-mono`) render bằng Geist;
  - Chữ có dấu rơi về **font hệ thống** (Segoe UI / Consolas trên Windows) → lệch font ngay trong cùng một dòng chữ.
  - Các class `font-mono` không được map trong `@theme` của Tailwind v4 → rơi về mono stack mặc định của hệ điều hành (thêm một nguồn lệch nữa).
- **Khắc phục (`app/layout.tsx` + `app/globals.css`):**
  - Thay Geist + localFont bằng **Inter** (`--font-sans`) và **JetBrains Mono** (`--font-mono`), cả hai đều khai báo `subsets: ["latin", "vietnamese"]`, `display: "swap"`.
  - Bổ sung `--font-mono: var(--font-mono);` vào `@theme inline` trong `globals.css` để mọi class `font-mono` dùng JetBrains Mono đồng nhất.
- **Hệ quả phụ được khắc phục:** Vì font mới hỗ trợ đầy đủ dấu, **khôi phục tiếng Việt có dấu** cho toàn bộ shell vốn bị viết không dấu để né lỗi font cũ:
  - `page.tsx`: 9 label điều hướng ("Bang Dieu Hanh" → "Bảng Điều Hành"...), placeholder tìm kiếm, "Kết quả/Gợi ý nhanh/Không tìm thấy", 3 quick links.
  - `app-header.tsx`: "Tìm kiếm nhanh", title "Đăng xuất".
  - `app-sidebar.tsx`: title "Đăng xuất hệ thống".
  - `employees-view.tsx`: header CSV export ("Mã NV", "Họ tên"...) — an toàn vì blob CSV đã có BOM `\uFEFF`.
- **Dọn dẹp:** Xóa file template Create-Next-App thừa: `app/page.module.css` (không còn import), `app/fonts/GeistVF.woff`, `app/fonts/GeistMonoVF.woff`.

### 1.4. Tham Chiếu Model Cũ "Gemini 2.5" Trong UI 🏷️
- Quét toàn bộ `components/` phát hiện **3 chỗ còn sót**, đã chuẩn hóa về **Gemini 3.1 Flash Lite** theo chuẩn AGENTS.md:
  1. `app-header.tsx` — dòng brand: `NestJS 11 • n8n • Gemini 2.5` → `Gemini 3.1 Flash Lite`;
  2. `training-analytics-view.tsx` — mô tả "2 câu tự luận tình huống (Gemini 2.5 chấm)";
  3. `training-analytics-view.tsx` — thẻ "AI Gemini 2.5 chấm điểm qua WF03".
- Lưu ý: thư mục `Khóa Luận/` và `scripts/` là nhật ký lịch sử nên **giữ nguyên** giá trị tham chiếu thời điểm đó.

---

## 2. Sửa Lỗi Phiên Chat WF02 Luôn Lưu / Kéo Lại Đoạn Chat Cũ 💬

### 2.1. Triệu Chứng
- Tab **WF02 - HR Q&A Agent** trong AI Sandbox luôn hiển thị lại nguyên đoạn chat của những lần trước (kể cả sau khi qua ngày mới), và mọi lượt chat mới tiếp tục được nối vào đúng đoạn cũ — trong khi các tab khác không có hiện tượng này.

### 2.2. Phân Tích Nguyên Nhân (3 Lỗi Chồng Nhau)
1. **Portal luôn gửi kèm `sessionId`** đã rehydrate từ server (`getLatestSession('HR_QA')` → `chat-store`), khiến backend không bao giờ đi vào nhánh get-or-create.
2. **`portalChat()` chỉ validate `{ id, employeeId }`** — không check `isActive`, không check cùng ngày → quy tắc **Q7** ("quá 12h đêm VN → đóng phiên cũ, mở phiên mới") nằm trong `createOrGetSession()` bị **bypass hoàn toàn**. Phiên cũ được nối tiếp vô hạn.
3. **`GET /agents/chat-session/latest/:type` trả phiên mới nhất bất kể ngày/isActive**, kèm toàn bộ messages → mở tab là thấy lại chat cũ.

- **Vì sao chỉ WF02 lộ lỗi:** WF02 là tab duy nhất render lại toàn bộ hội thoại khi mở (WF01 chỉ có sandbox không hiện transcript; WF03 là flow quiz; WF04 chỉ-đọc). Ngoài ra `sessionType: OTHER` (nút **Ping AI** và Router Sandbox E2E ở tab WF01) bị backend chuẩn hóa về **HR_QA** → tin nhắn kiểm thử từ tab khác cũng chui vào phiên HR_QA của WF02, làm lịch sử WF02 thêm "dơ".

### 2.3. Cơ Chế Lưu Chat 3 Lớp Của WF02 (Ghi Nhận Kiến Trúc)
| Lớp | Node trong WF02 | Bảng | Mục đích |
|---|---|---|---|
| 1 | `Save User Message` (HTTP → NestJS) | `ai_chat_messages` (role=user) | Audit trail |
| 2 | `Postgres Chat Memory` (ADR-0001) | `n8n_chat_histories`, key = sessionId, window 50 | Ngữ cảnh LLM đa lượt |
| 3 | `Save Assistant Message` (HTTP → NestJS) | `ai_chat_messages` (role=assistant, metadata model/intent/latency_ms) | Audit + số liệu `/agents/performance`, `/agents/intent-stats` |

→ Việc lưu là **by design**; lỗi nằm ở việc phiên không bao giờ hết hạn. `Postgres Chat Memory` không cần đổi: key là sessionId, sessionId xoay thì memory tự sạch.

### 2.4. Khắc Phục (Backend — Áp Đúng Thiết Kế Q7/Q16/Q18)
- **`ai-context.service.ts` — `createOrGetSession()` trở thành nguồn chân lý duy nhất về quy tắc phiên:**
  - Nhánh explicit `sessionId` chỉ được dùng lại nếu phiên **còn active + đúng chủ sở hữu (employeeId) + cùng ngày theo múi giờ VN (Asia/Ho_Chi_Minh)** — chống dùng chéo sessionId người khác; khác ngày → rơi xuống logic đóng phiên cũ + tạo phiên mới.
  - Lookup phiên gần nhất ưu tiên match đúng `(employeeId, type, channel)` thay vì OR rộng với `externalId` — tránh nhặt nhầm phiên loại khác; `externalId` chỉ dùng cho kênh ngoài (Zalo/Slack) không có employeeId nội bộ.
  - Helper `vnDate(d)` chuẩn hóa so sánh ngày VN.
  - Thêm `getRehydratableWebSession()`: chỉ trả phiên **active + cùng ngày** cho mục đích rehydrate UI; `getLatestWebSession()` giữ nguyên cho `renewWebSession` (cần đóng cả phiên cũ hạn).
- **`agents.service.ts` — `portalChat()`:** bỏ lookup thủ công, giao việc resolution phiên hoàn toàn cho `createOrGetSession()` (một nơi, một bộ quy tắc).
- **`portal.controller.ts`:** endpoint `GET /agents/chat-session/latest/:type` chuyển sang `getRehydratableWebSession` → mở tab chat ngày mới = sạch hoàn toàn.
- **Kết quả:** Trong cùng ngày chat vẫn liên tục (audit trail + memory đầy đủ như thiết kế); sang ngày mới hoặc bấm "Phiên mới" (Q19) → phiên mới sạch. n8n WF02 không cần thay đổi.

### 2.5. Việc Còn Mở (Đề Xuất)
- **Tách tin nhắn Ping / Router Sandbox** khỏi phiên HR_QA của WF02: hiện `sessionType: OTHER` bị chuẩn hóa về `HR_QA` (tránh lỗi Prisma enum). Muốn tách hẳn cần thêm enum `OTHER` vào `ChatSessionType` (Prisma migration) — chờ quyết định.

---

## 3. Kiểm Thử & Xác Minh ✅
- `pnpm --filter web build` — **pass** (Next.js 16.3.0 + Turbopack, TypeScript OK, font Inter/JetBrains Mono subset vietnamese tải build-time thành công).
- `pnpm --filter api check-types` — **pass** (`tsc --noEmit`, 0 lỗi).
- Runtime cần kiểm thử lại thủ công: (1) nút "Xem & Duyệt" mở modal và duyệt/từ chối thành công; (2) qua ngày mới mở tab WF02 → chat sạch; (3) "Phiên mới" hoạt động như cũ.
