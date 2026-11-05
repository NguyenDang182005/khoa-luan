---
tags: [khoa-luan, frontend, ui, ux, design-system, redesign, verified]
created: 2026-11-04
---

# 🎨 Redesign Giao Diện Light Theme & Rà Soát UX Nhân Viên (04-11-2026)

> [!IMPORTANT]
> Toàn bộ web portal chuyển từ **dark navy** sang **light theme** — sáng, nhẹ, tin cậy. Giữ nguyên 100% chức năng, API, Zod schema, RBAC, WebSocket; chỉ đổi giao diện. 9 màn + shell + bộ component dùng chung. Đã rà UX phần nhân viên với API thật và gỡ toàn bộ thông tin ping/độ trễ. `tsc` + `eslint --max-warnings 0` sạch. **Chưa commit.**

## 1. Quy trình

1. Brief thiết kế (tokens, điều hướng, spec 10 màn) → audit source hiện trạng.
2. Prototype HTML 3 màn ưu tiên (Đăng nhập, Bảng điều hành, Cổng nhân viên) → người dùng **duyệt**.
3. Áp token + component + shell vào code; 6 màn còn lại làm song song theo một quy tắc chung.
4. Rà UX phần nhân viên với API thật → sửa 7 lỗi.
5. Gỡ toàn bộ thông tin ping/độ trễ khỏi giao diện.

| File tham chiếu | Nội dung |
|---|---|
| `design/redesign-light/prototype.html` | Prototype 3 màn đã duyệt (mở thẳng bằng trình duyệt) |
| `design/redesign-light/IMPLEMENTATION.md` | Quy tắc áp dụng: token, thang chữ, component, checklist grep |
| `apps/web/app/globals.css` | Token light + `@theme inline` + thang chữ; dark cũ chuyển vào `.dark` |

## 2. Audit hiện trạng (trước redesign)

- Icon rail 64px chỉ có icon, phải hover `title` mới biết mục gì.
- Màu hardcode tràn lan: `emerald/rose/amber/purple` trong badge, gradient logo indigo→purple.
- Chữ 9–10px, nhiều nhãn `uppercase tracking-wider`.
- Login kiểu Google (`#1a73e8`) lệch hẳn với app tối phía sau.
- Trạng thái chỉ báo bằng màu, không kèm nhãn/icon.

## 3. Design tokens (giữ tên biến cũ, đổi giá trị)

| Nhóm | Giá trị chính |
|---|---|
| Nền / card / viền | `#F7F8FA` / `#FFFFFF` / `#E4E7EC` |
| Chữ chính / phụ | `#101828` / `#667085` (4,8:1 trên trắng — đạt AA) |
| Primary (duy nhất) | `#2563EB`, hover `#1D4ED8`, tint `#EFF4FF` |
| Trạng thái | success `#067647` · warning `#B54708` · danger `#B42318` · info `#026AA2` |
| AI | violet `#7C3AED` / `#F5F3FF` — chỉ dùng cho thứ thuộc AI |
| Agent | WF01 violet · WF02 blue · WF03 amber · WF04 rose (`--agent-wf01..04`; tên cũ teal/blue/amber/coral thành alias) |
| Radius | card 12 · input/button 8 · tag 6 · modal 16 |
| Shadow | chỉ cho popover/modal (`--shadow-pop`, `--shadow-modal`) |

**Thang chữ:** `text-display` 30/36 · `text-h1` 24/32 · `text-h2` 20/28 · `text-h3` 16/24 · `text-body` 14/22 · `text-body-sm` 13/20 · `text-caption` 12/18 · `text-micro` 11/16. Số liệu dùng class `tabular`; loading dùng class `skeleton` (shimmer, tắt khi reduced-motion).

> [!NOTE]
> Skill thiết kế gợi ý glassmorphism + font Plus Jakarta — **không dùng** vì brief cấm blur/gradient và Inter đã có subset tiếng Việt.

## 4. Shell & điều hướng mới

- **Sidebar 240px có nhãn chữ**, chia nhóm: Tổng quan / Nhân sự / Vận hành AI / Phát triển / Cá nhân / Hệ thống. Thu gọn về 72px (nhớ bằng `localStorage`), dưới 1024px thành drawer.
- Admin thấy thêm nhóm **"Cá nhân → Cổng nhân viên"** (code cũ cho admin vào màn này, brief không liệt kê — giữ để không mất chức năng).
- Nhân viên thấy nhóm **"Của tôi"**: Cổng nhân viên, Kết quả đào tạo, Trợ lý AI.
- **Header 64px:** breadcrumb nhóm › trang, ô tìm kiếm 320px (Ctrl/⌘K), menu người dùng (tên, vai trò, Đăng xuất).
- Màn Trợ lý AI dùng layout full-bleed (tự quản chiều cao); các màn khác nằm trong khung `max-w-[1440px]`, padding 16/24/32.
- **Không thêm chuông thông báo** — app chưa có tính năng thông báo, thêm vào sẽ là chấm đỏ giả.

## 5. Bộ component dùng chung (`components/ui/`)

Button (primary/outline/ghost/destructive, cao 32/36/40), Badge (success/warning/destructive/info/ai + 4 agent), Card, Input/Textarea (cao 40, focus ring 3px), Tabs dạng gạch chân, Table (header 44 nền `#F9FAFB`, row 56), Dialog (bottom sheet trên mobile), Popover, Switch, Avatar, Tooltip. **Giữ nguyên tên variant** → không phải sửa call-site.

## 6. Từng màn

| Màn | Điểm chính |
|---|---|
| Đăng nhập | Card 420px, logo Google/Facebook chuẩn (bỏ icon Chrome), lỗi inline, tài khoản mẫu theo env |
| Bảng điều hành | 4 KPI, AreaChart (thêm đường nghỉ phép — API đã trả nhưng trước không vẽ), donut + legend %, đơn chờ duyệt, hoạt động AI theo agent |
| Hồ sơ nhân sự | Dãy chip phòng ban → `<select>`; drawer 480px; tab duyệt đơn có chip tổng; tab hội nhập có thanh tiến độ tổng |
| Bảng lương & thuế | 4 ô tổng, bảng cột tiền căn phải + dòng tổng, thanh hành động nổi khi chọn phiếu |
| Trợ lý AI | Cột agent 280px, bubble chat sáng, composer textarea (Enter gửi, Shift+Enter xuống dòng) |
| Tiếp quản CSKH | Danh sách 340px + chat, segmented "Chờ tiếp quản / Tất cả", PII audit thành bảng |
| Đào tạo & Radar AI | Radar (chuẩn công ty nét đứt), bảng xếp hạng có 4 mini bar tiêu chí, bar chart theo phòng ban |
| Kết quả đào tạo | 3 KPI, radar + "Nhận xét từ AI", bảng lịch sử |
| Cài đặt | Nav phụ 220px có chấm "chưa lưu", form 2 cột, thanh lưu dính đáy |
| Cổng nhân viên | 3 thẻ (chấm công / phép / phiếu lương), lịch công phẳng 7 cột + popover, modal tạo đơn, nút AI nổi 56px |

**Khác brief có chủ đích:** drawer hồ sơ là "Đóng / Sửa hồ sơ" (sửa trong dialog sẵn có); thanh lưu Cài đặt không có "Huỷ" (không có hàm hoàn tác).

## 7. Rà soát UX phần nhân viên (API thật, tài khoản `employee1`)

| # | Lỗi | Sửa |
|---|---|---|
| 1 | Hôm nay chưa check-in bị ghi **"Vắng mặt không phép"** và cộng vào số vắng (lỗi có từ trước) | Hiện "Chưa chấm công", không tính vắng |
| 2 | Ngày hoàn thành hội nhập "16/1/2026" | dd/MM/yyyy → "16/01/2026" |
| 3 | Gửi form tạo đơn lỗi → focus vẫn ở nút Gửi | Focus nhảy vào ô lỗi đầu tiên |
| 4 | Ô nhập 14px → iOS tự zoom khi chạm | 16px dưới 640px (CSS ngoài `@layer` để thắng class Tailwind) |
| 5 | 375px: "Chấm công GPS" bẻ 2 dòng vì badge | Badge xuống dòng riêng |
| 6 | Panel AI trên mobile không có nền mờ, chạm ngoài không đóng | Thêm overlay, chạm ngoài để đóng |
| 7 | "0.0/10", "Remote", "AI Hybrid Assessment", "Phiếu lương gần nhất" (thực ra chỉ kỳ đang xem) | "0,0/10", "Làm từ xa", "đánh giá kết hợp…", "Phiếu lương" |

Kiểm tra 375px: không cuộn ngang ở cả 3 màn nhân viên.

## 8. Gỡ thông tin ping / độ trễ

| Màn | Đã bỏ |
|---|---|
| Bảng điều hành | Thanh độ trễ + "⌀ … ms" mỗi agent |
| Trợ lý AI | Ô "Độ trễ gần nhất", "…ms" trên thẻ agent (→ "Hoạt động"), số ms trên nút kiểm tra, "Độ trễ" trong Sandbox và tin nhắn |
| Cổng nhân viên | Số ms dưới câu trả lời của trợ lý |
| Cài đặt › Tích hợp, AI Agent | Số ms mỗi dịch vụ, chữ "ping" / "đo trễ" trong mô tả |

Giữ: các nút "Kiểm tra kết nối" (chỉ báo OK/lỗi), ô cấu hình "Timeout (ms)". Dữ liệu latency từ API vẫn nhận nhưng không hiển thị → **không sửa backend**.

## 9. Kiểm chứng

- `npx tsc --noEmit` sạch; `eslint --max-warnings 0` sạch.
- Quét `components/` + `app/`: không còn màu hardcode (`emerald-*`, `#hex`, `oklch`), `text-[9/10px]`, `backdrop-blur`, gradient — ngoại lệ duy nhất là màu thương hiệu logo Google/Facebook.
- Xem trên trình duyệt với API thật: 3 màn nhân viên (1440px + 375px), Bảng điều hành, Trợ lý AI, Cài đặt (admin).

## 10. Còn lại

- [ ] Commit (web + `design/redesign-light/` + `.claude/launch.json`)
- [ ] Thẻ phiếu lương chỉ xem tháng hiện tại — muốn hiện phiếu gần nhất có dữ liệu cần đổi logic gọi API
- [ ] Trợ lý AI cho nhân viên chưa có câu hỏi gợi ý; tên agent còn tiếng Anh ("HR Policy Q&A Agent")
- [ ] Ô chọn ngày hiển thị theo ngôn ngữ trình duyệt (en-US ra MM/dd)
- [ ] `vnd()` trả "₫NaN" khi API lỗi (có từ trước)
- [ ] Chưa thử Check-in / gửi đơn / chat AI thật sau redesign (ghi dữ liệu)

## 11. Cập nhật 05-11-2026

- Đã sửa `vnd()` trả `0 ₫` thay vì `₫NaN`/`₫0`; đồng bộ ngày `dd/MM/yyyy`, giờ 24h, số thập phân dấu phẩy.
- Đã đối chiếu 36 GET endpoint với DB: 31 hồ sơ = 30 đang làm việc + 1 TERMINATED (EMP018); dashboard hiển thị rõ 31 / 30 / 1.
- Đã sửa 6 tin `ai_chat_messages` + 3 `n8n_chat_histories` bị hỏng encoding (`�`), không phải lỗi font.
- Đã sửa quiz WF03: câu hỏi tiếng Việt có dấu, đáp án đúng và nhận xét tự luận hiển thị đầy đủ.
- Đã tinh chỉnh toolbar bảng lương, composer chat (2 dòng, không cuộn ngang) và giảm density toàn giao diện.
- Chi tiết + số liệu đầy đủ: [[35 - Audit Số Liệu, Sửa Encoding & Tinh Chỉnh Density (05-11-2026)]]
- Riêng phần quiz: [[36 - Sửa Quiz Đào Tạo Tiếng Việt & Chấm Tự Luận (05-11-2026)]]

---

*Liên kết:* [[33 - Chuyển AI Agent Sang DeepSeek & Rà Soát Logic UI (03-11-2026)]] | [[03 - Web Portal (Next.js)]] | [[09 - Task Checklist]]
