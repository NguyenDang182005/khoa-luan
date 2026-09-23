---
tags: [khoa-luan, web-portal, cskh, escalation, ui-ux, bug-fix, human-in-the-loop]
created: 2026-09-17
updated: 2026-09-17
status: completed
---

# 🎨 Redesign UI Bàn Tiếp Quản CSKH & 🐛 Fix Bug Toggle Bot (17-09-2026)

> **Bối cảnh:** Trang Bàn Tiếp Quản CSKH (`cskh-escalation-view.tsx`) có 3 vấn đề UX nghiêm trọng khi toggle bot; sau redesign lại phát hiện bug "bấm toggle xong trạng thái lật ngược như cũ". Cả hai đã xử lý xong và kiểm thử đạt.

---

## 1. Redesign UI/UX — giữ nguyên 100% luồng hoạt động

### 3 vấn đề được xác nhận trong code cũ

| # | Vấn đề | Nguyên nhân trong code |
|---|---|---|
| 1 | **Hero banner lật đổi theo selection** | Banner toàn trang render 2 thiết kế khác nhau (coral "CẢNH BÁO ESCALATION" ↔ teal "HỘP THƯ AI") dựa trên `meta.escalated` của hội thoại đang chọn → toggle/chuyển phiên là cả trang nhảy màu + nhảy chiều cao |
| 2 | **2 nút cùng một chức năng** | Toggle switch trong mỗi item danh sách + nút "🤖 Bật Lại Bot AI Ngay" ở header chat + badge "Bot Đang Hoạt Động" — 3 kiểu hiển thị cho cùng 1 trạng thái bot |
| 3 | **Khung hội thoại nhảy vị trí khi toggle** | `activeCase = displayList.find(...) ?? displayList[0]` — sau toggle, phiên rời hàng đợi "Chờ tiếp quản" → selection bị reset sang phiên khác |

### Thiết kế mới

| Thành phần | Trước | Sau |
|---|---|---|
| Header trang | Banner động đổi theo phiên | **Header tĩnh 100%**: tiêu đề + mô tả + dải chỉ số sống (số phiên chờ • tổng hội thoại • giờ đồng bộ, chu kỳ 10s) |
| Điều khiển bot | 2 nơi (toggle trong card + nút header chat) | **1 segmented control duy nhất** "Bot AI ↔ Chuyên viên" ở header khung chat; danh sách chỉ xem (badge trạng thái) |
| Selection | Reset khi phiên rời filter | **Lookup hợp nhất** (queue + conversations) — khung chat giữ đúng phiên kể cả khi nó rời bộ lọc |
| Trạng thái API | Chờ refetch (tới 10s) | **Optimistic update + rollback** nếu lỗi |
| Lý do escalate | Banner toàn trang | Dải cảnh báo mảnh **nằm trong khung chat**, đúng ngữ cảnh |
| Tin nhắn | Bot & human cùng màu | 3 vai trò phân biệt: **Khách** (trái, xám) / **AI Bot** (phải, primary) / **Bạn — Chuyên viên** (phải, viền teal) + auto-scroll |
| Layout | Nhảy theo trạng thái | Chiều cao khung chat cố định 560px, list scroll riêng — không layout shift |

Luồng giữ nguyên: poll 10s, filter "Chờ tiếp quản / Tất cả", human reply → Slack DM, bật/tắt bot, tab PII Audit, phân biệt lỗi 403 / hết dữ liệu.

---

## 2. 🐛 Bug Toggle Bot — "bấm xong trạng thái vẫn như cũ"

### Chẩn đoán (feedback loop API thật)

Script `scripts/diag-toggle.mjs` — đăng nhập JWT → GET conversations → POST deactivate/reactivate → assert contract. Kết quả: **API chạy ĐÚNG 100%** (state DB lật đúng 2 chiều, hàng đợi vào/ra đúng, khôi phục đúng; NestJS `@Post` trả 201 là chuẩn).

### Nguyên nhân gốc

```
WF04 (n8n) gửi tin nhắn assistant kèm metadata:
  { model, escalated: shouldEscalate, escalateReason }   ← SNAPSHOT tại thời điểm gửi tin

GET /agents/conversations trả về:
  escalated: !session.isActive                            ← AUTHORITATIVE từ DB
  metadata:  ...chứa snapshot cũ ở trên
```

- Luật merge **cũ** trong component: `escalated: c.metadata?.escalated ?? fallback` → **snapshot cũ thắng**
- Session `cmu2e6up…`: server nói `escalated=false` nhưng metadata kẹt `escalated=true` → UI hiển thị "Tiếp quản" vĩnh viễn dù đã bật bot
- Chuỗi bug: bấm toggle → optimistic đổi ngay ✓ → API ghi DB ✓ → `fetchQueues()` trả payload → metadata cũ ghi đè → **UI lật ngược lại** ❌
- Metadata là dữ liệu **write-once lúc escalate**, không bao giờ được cập nhật khi admin toggle sau đó → không bao giờ dùng làm trạng thái hiện tại được

### Fix

Trong `cskh-escalation-view.tsx` (`caseLookup` + `displayList`):

```typescript
// Nguồn sự thật của `escalated`:
//  - GET /agents/conversations → trường `escalated: !isActive` luôn thắng
//  - Item hàng đợi lọc bởi isActive: false → escalated=true theo định nghĩa
//  - KHÔNG dùng metadata.escalated của tin nhắn (snapshot cũ)
for (const item of escalationQueue)
  map.set(item.id, { ...item, metadata: { ...(item.metadata ?? {}), escalated: true } })
for (const conv of allConversations)
  map.set(conv.id, { ...conv, metadata: { ...(conv.metadata ?? {}), escalated: conv.escalated } })
```

`escalateReason` / `model` / `customerName` vẫn đọc từ metadata như cũ.

---

## 3. Kết quả kiểm thử

| Kiểm tra | Kết quả |
|---|---|
| `node scripts/diag-toggle.mjs` (sau fix) | ✅ 9/9 assertion PASS, exit 0 — API contract + rule mới khớp server |
| ESLint `cskh-escalation-view.tsx` | ✅ 0 lỗi / 0 warning |
| `tsc --noEmit` (apps/web) | ✅ 0 errors |
| Toggle 2 chiều + khôi phục trạng thái gốc trên DB thật | ✅ Đạt |

> Ghi chú: `apps/web` chưa có unit-test runner → chưa có seam viết regression test đơn vị cho luật merge; `scripts/diag-toggle.mjs` (1 lệnh, vài giây) đóng vai trò regression check tại seam API thật.

---

## 4. Files Changed

| File | Thay đổi |
|---|---|
| `apps/web/components/views/cskh-escalation-view.tsx` | Redesign toàn bộ view + fix luật merge `escalated` |
| `scripts/diag-toggle.mjs` | NEW — feedback loop kiểm tra API toggle (regression check) |

Không đổi: API endpoints, Prisma schema, n8n workflows, Zod schemas.

---

*Liên kết: [[17 - Nhật Ký Ngày 17-09-2026]] | [[03 - Web Portal (Next.js)]] | [[06 - n8n Workflows & AI Agents]] | [[2026-09-15 Fix Bug Sửa Hồ Sơ - Zod Parse Sai Shape Response PATCH]]*
